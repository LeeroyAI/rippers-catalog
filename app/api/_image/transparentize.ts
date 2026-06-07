import sharp from "sharp";

import { whiteToAlpha } from "@/src/domain/white-to-alpha";

/**
 * Server-side white-background knockout for retailer hero/product images.
 *
 * Decodes with sharp, hands the raw RGBA buffer to the pure `whiteToAlpha`
 * flood-fill, and re-encodes to WebP with alpha. Returns `null` when the image
 * already has transparency, has no white border, or anything goes wrong, so the
 * caller serves the original bytes untouched.
 *
 * Lives under `_image/` (underscore = private folder, never routed) so both
 * `bike-img/[id]` and `bike-img-proxy` can share it.
 */

const MAX_DIM = 1200; // bound decode/flood-fill/encode cost on the B1 instance.

export type Transparentized = { buffer: Buffer; contentType: "image/webp" };

/**
 * Knock out a white product-photo background. Returns the transparent WebP, or
 * `null` to signal "serve the original".
 */
export async function transparentizeWhiteBackground(
  input: Buffer
): Promise<Transparentized | null> {
  try {
    const base = sharp(input, { failOn: "none" }).rotate(); // honour EXIF orientation
    const meta = await base.metadata();

    // Already transparent (e.g. a PNG with alpha) -> nothing to do.
    if (meta.hasAlpha) return null;

    const tooBig = (meta.width ?? 0) > MAX_DIM || (meta.height ?? 0) > MAX_DIM;
    const pipeline = tooBig
      ? base.resize({ width: MAX_DIM, height: MAX_DIM, fit: "inside", withoutEnlargement: true })
      : base;

    const { data, info } = await pipeline.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (info.channels !== 4) return null;

    const result = whiteToAlpha(data, info.width, info.height);
    if (!result.changed) return null;

    const out = await sharp(data, {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .webp({ quality: 86, alphaQuality: 90, effort: 4 })
      .toBuffer();

    return { buffer: out, contentType: "image/webp" };
  } catch {
    return null;
  }
}

/**
 * Tiny process-level LRU so the B1 box does not re-run sharp on every request
 * for the same image. App Service has no CDN in front, so route handlers run
 * per request; this memoises the (small, compressed) WebP output by key.
 */
type CacheEntry = { buffer: Buffer; contentType: string } | null; // null = "serve original"

const MEMO = new Map<string, CacheEntry>();
const MEMO_MAX = 64;

export function getMemoized(key: string): CacheEntry | undefined {
  const hit = MEMO.get(key);
  if (hit !== undefined) {
    // refresh recency
    MEMO.delete(key);
    MEMO.set(key, hit);
  }
  return hit;
}

export function setMemoized(key: string, value: CacheEntry): void {
  if (MEMO.has(key)) MEMO.delete(key);
  MEMO.set(key, value);
  while (MEMO.size > MEMO_MAX) {
    const oldest = MEMO.keys().next().value;
    if (oldest === undefined) break;
    MEMO.delete(oldest);
  }
}
