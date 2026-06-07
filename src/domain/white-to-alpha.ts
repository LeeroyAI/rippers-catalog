/**
 * Background knockout for product photos shot on white.
 *
 * Pure pixel logic (no `sharp`, no Node APIs) so it is unit-testable: operates
 * in place on a flat RGBA byte buffer. The sharp decode/encode lives in
 * `app/api/_image/transparentize.ts`, which calls this.
 *
 * Strategy: flood-fill the near-white background that is *connected to the image
 * border* and set its alpha to 0. Flood-fill (rather than a global "white ->
 * transparent" threshold) is what stops us from punching holes through white
 * parts of the bike itself (white frames, decals, number boards).
 */

export type WhiteToAlphaOptions = {
  /** A pixel is "white-ish" when its smallest channel is >= this (0-255). */
  bgThreshold?: number;
  /** ...and its channel spread (max - min) is <= this (keeps it neutral, not a pale colour). */
  maxChroma?: number;
  /** Bail out unless at least this fraction of the border is white-ish. */
  minBorderCoverage?: number;
  /** Soften the 1px halo left on the kept side of the cut. */
  feather?: boolean;
};

export type WhiteToAlphaResult = {
  /** True when a white border was found and knocked out. */
  changed: boolean;
  /** Number of fully-cleared pixels (diagnostics / tests). */
  clearedPixels: number;
};

const DEFAULTS = {
  bgThreshold: 232,
  maxChroma: 16,
  minBorderCoverage: 0.5,
  feather: true,
};

/**
 * Knock out the border-connected white background in `data` (RGBA, length
 * `width * height * 4`). Mutates `data` in place. Returns `{ changed: false }`
 * without touching anything when the image has no white border, so the caller
 * can serve the original untouched.
 */
export function whiteToAlpha(
  data: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  options: WhiteToAlphaOptions = {}
): WhiteToAlphaResult {
  const bgThreshold = options.bgThreshold ?? DEFAULTS.bgThreshold;
  const maxChroma = options.maxChroma ?? DEFAULTS.maxChroma;
  const minBorderCoverage = options.minBorderCoverage ?? DEFAULTS.minBorderCoverage;
  const feather = options.feather ?? DEFAULTS.feather;

  const n = width * height;
  if (width <= 0 || height <= 0 || data.length < n * 4) {
    return { changed: false, clearedPixels: 0 };
  }

  const isWhiteish = (p: number): boolean => {
    const i = p * 4;
    if (data[i + 3] < 250) return false; // already (semi)transparent: not a candidate
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const min = r < g ? (r < b ? r : b) : g < b ? g : b;
    const max = r > g ? (r > b ? r : b) : g > b ? g : b;
    return min >= bgThreshold && max - min <= maxChroma;
  };

  // Gate: only run when the border is mostly white, so coloured-backdrop or
  // full-bleed photos pass through unchanged.
  let borderTotal = 0;
  let borderWhite = 0;
  const countBorder = (p: number) => {
    borderTotal++;
    if (isWhiteish(p)) borderWhite++;
  };
  for (let x = 0; x < width; x++) {
    countBorder(x);
    countBorder((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y++) {
    countBorder(y * width);
    countBorder(y * width + (width - 1));
  }
  if (borderTotal === 0 || borderWhite / borderTotal < minBorderCoverage) {
    return { changed: false, clearedPixels: 0 };
  }

  // Flood-fill (4-connectivity, iterative stack) from every white border pixel.
  const visited = new Uint8Array(n);
  const stack: number[] = [];
  const pushIf = (p: number) => {
    if (!visited[p] && isWhiteish(p)) {
      visited[p] = 1;
      stack.push(p);
    }
  };
  for (let x = 0; x < width; x++) {
    pushIf(x);
    pushIf((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    pushIf(y * width);
    pushIf(y * width + (width - 1));
  }

  let cleared = 0;
  while (stack.length > 0) {
    const p = stack.pop() as number;
    data[p * 4 + 3] = 0;
    cleared++;
    const x = p % width;
    const y = (p - x) / width;
    if (x > 0) pushIf(p - 1);
    if (x < width - 1) pushIf(p + 1);
    if (y > 0) pushIf(p - width);
    if (y < height - 1) pushIf(p + width);
  }

  if (cleared === 0) {
    return { changed: false, clearedPixels: 0 };
  }

  // Feather: anti-aliased edge pixels just inside the cut are part bike, part
  // white, so they leave a pale halo. Drop their alpha in proportion to how
  // white they still are. Only touches kept pixels that border a cleared one.
  if (feather) {
    const featherFloor = Math.max(0, bgThreshold - 22);
    const span = 255 - featherFloor || 1;
    for (let p = 0; p < n; p++) {
      if (visited[p]) continue; // this pixel was cleared
      const x = p % width;
      const y = (p - x) / width;
      const touchesCleared =
        (x > 0 && visited[p - 1] === 1) ||
        (x < width - 1 && visited[p + 1] === 1) ||
        (y > 0 && visited[p - width] === 1) ||
        (y < height - 1 && visited[p + width] === 1);
      if (!touchesCleared) continue;
      const i = p * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const min = r < g ? (r < b ? r : b) : g < b ? g : b;
      if (min < featherFloor) continue;
      // min == 255 -> alpha 0 (most white); min == featherFloor -> alpha 255.
      const newAlpha = Math.round(255 * (1 - (min - featherFloor) / span));
      if (newAlpha < data[i + 3]) data[i + 3] = newAlpha;
    }
  }

  return { changed: true, clearedPixels: cleared };
}
