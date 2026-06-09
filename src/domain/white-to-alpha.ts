/**
 * Background knockout for product photos shot on white.
 *
 * Pure pixel logic (no `sharp`, no Node APIs) so it is unit-testable: operates
 * in place on a flat RGBA byte buffer. The sharp decode/encode lives in
 * `app/api/_image/transparentize.ts`, which calls this.
 *
 * Strategy: flood-fill the light, low-chroma background that is *connected to
 * the image border* and clear it to transparent. Flood-fill (rather than a
 * global "white -> transparent" threshold) is what stops us punching holes
 * through white parts of the bike itself (white frames, decals, number boards).
 *
 * Two refinements make the cut look clean rather than "average":
 *   1. The connectivity threshold reaches down into light GREY, so soft drop
 *      shadows under the wheels (which are part of the background, not the bike)
 *      get cleared instead of left as floating smudges.
 *   2. A feathered boundary ramps the alpha of the kept pixels that border the
 *      cut in proportion to how light they are, which dissolves the white halo
 *      / fringe left by anti-aliased edges.
 */

export type WhiteToAlphaOptions = {
  /** At/above this min-channel value (and low chroma) a pixel is pure background -> alpha 0. */
  bgThreshold?: number;
  /** Flood-fill reaches any connected pixel this light or lighter (catches soft shadow). */
  connectThreshold?: number;
  /** Max channel spread (max - min) for a pixel to count as neutral background. */
  maxChroma?: number;
  /** Bail out unless at least this fraction of the border is clearly light. */
  minBorderCoverage?: number;
  /** Kept pixels within this many px of the cut get alpha-feathered (0 disables). */
  featherRadius?: number;
  /** Only feather kept pixels at least this light (darker bike edges keep full alpha). */
  featherFloor?: number;
  /**
   * Also clear border-DISCONNECTED near-white (wheel interiors, frame triangle)
   * when the subject is predominantly dark — gives a clean cutout without
   * punching holes in genuinely white/silver bikes. Default true.
   */
  clearEnclosedIfDark?: boolean;
};

export type WhiteToAlphaResult = {
  /** True when a light border was found and knocked out. */
  changed: boolean;
  /** Number of fully-cleared pixels (diagnostics / tests). */
  clearedPixels: number;
};

const DEFAULTS = {
  bgThreshold: 236,
  connectThreshold: 198,
  maxChroma: 32,
  minBorderCoverage: 0.5,
  featherRadius: 2,
  // Only feather genuinely near-white fringe; light-grey subject edges keep full
  // alpha so the knockout never erodes white/silver bikes.
  featherFloor: 175,
  /** Border-coverage gate uses a stricter "clearly light" test than the flood fill. */
  gateThreshold: 224,
};

/**
 * Knock out the border-connected light background in `data` (RGBA, length
 * `width * height * 4`). Mutates `data` in place. Returns `{ changed: false }`
 * without touching anything when the image has no light border, so the caller
 * can serve the original untouched.
 */
export function whiteToAlpha(
  data: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  options: WhiteToAlphaOptions = {}
): WhiteToAlphaResult {
  const bgThreshold = options.bgThreshold ?? DEFAULTS.bgThreshold;
  const connectThreshold = options.connectThreshold ?? DEFAULTS.connectThreshold;
  const maxChroma = options.maxChroma ?? DEFAULTS.maxChroma;
  const minBorderCoverage = options.minBorderCoverage ?? DEFAULTS.minBorderCoverage;
  const featherRadius = options.featherRadius ?? DEFAULTS.featherRadius;
  const featherFloor = options.featherFloor ?? DEFAULTS.featherFloor;
  const clearEnclosedIfDark = options.clearEnclosedIfDark ?? true;

  const n = width * height;
  if (width <= 0 || height <= 0 || data.length < n * 4) {
    return { changed: false, clearedPixels: 0 };
  }

  const minChannel = (i: number): number => {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    return r < g ? (r < b ? r : b) : g < b ? g : b;
  };
  const chroma = (i: number): number => {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const min = r < g ? (r < b ? r : b) : g < b ? g : b;
    const max = r > g ? (r > b ? r : b) : g > b ? g : b;
    return max - min;
  };

  // Opaque + light + neutral, at a given lightness floor.
  const looksBackground = (p: number, floor: number): boolean => {
    const i = p * 4;
    if (data[i + 3] < 250) return false; // already (semi)transparent: not a candidate
    return minChannel(i) >= floor && chroma(i) <= maxChroma;
  };

  // Gate: only run when the border is mostly clearly-light, so coloured-backdrop
  // or full-bleed photos pass through unchanged.
  let borderTotal = 0;
  let borderLight = 0;
  const countBorder = (p: number) => {
    borderTotal++;
    if (looksBackground(p, DEFAULTS.gateThreshold)) borderLight++;
  };
  for (let x = 0; x < width; x++) {
    countBorder(x);
    countBorder((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y++) {
    countBorder(y * width);
    countBorder(y * width + (width - 1));
  }
  if (borderTotal === 0 || borderLight / borderTotal < minBorderCoverage) {
    return { changed: false, clearedPixels: 0 };
  }

  // Flood-fill (4-connectivity, iterative stack) from every light border pixel,
  // reaching down into light grey so connected soft shadows are included.
  const visited = new Uint8Array(n);
  const stack: number[] = [];
  const pushIf = (p: number) => {
    if (!visited[p] && looksBackground(p, connectThreshold)) {
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

  // Guarded enclosed-white removal. The border flood above leaves white that the
  // subject encloses (wheel interiors, frame triangle, AND a white painted panel)
  // untouched. If the remaining subject is predominantly DARK (a dark bike on
  // white), those enclosed white regions are background seen through gaps, so
  // clear them for a clean cutout. If the subject is light (white/silver bike),
  // skip — we must not punch holes in it.
  if (clearEnclosedIfDark) {
    let kept = 0;
    let dark = 0;
    for (let p = 0; p < n; p++) {
      if (visited[p]) continue;
      const i = p * 4;
      if (data[i + 3] === 0) continue;
      kept++;
      if (minChannel(i) < 110) dark++;
    }
    if (kept > 0 && dark / kept >= 0.42) {
      const enclosedFloor = 240; // only genuinely white gaps, not light-grey bike parts
      for (let p = 0; p < n; p++) {
        if (visited[p]) continue;
        const i = p * 4;
        if (data[i + 3] === 0) continue;
        if (minChannel(i) >= enclosedFloor && chroma(i) <= maxChroma) {
          data[i + 3] = 0;
          visited[p] = 1; // so the feather pass softens these new edges too
          cleared++;
        }
      }
    }
  }

  // Feather: anti-aliased edge pixels just inside the cut are part bike, part
  // background, so they leave a pale halo. For each kept pixel within
  // `featherRadius` of a cleared pixel, drop alpha toward 0 the lighter it is.
  // Lighter fringe (closer to the old background) goes more transparent; darker
  // genuine bike edges keep most of their alpha.
  if (featherRadius > 0 && featherFloor < bgThreshold) {
    const span = bgThreshold - featherFloor;
    const r2 = featherRadius;
    for (let p = 0; p < n; p++) {
      if (visited[p]) continue; // cleared pixel
      const i = p * 4;
      if (data[i + 3] === 0) continue;
      const min = minChannel(i);
      if (min < featherFloor) continue; // dark bike edge: keep it
      if (chroma(i) > maxChroma + 12) continue; // saturated colour: not fringe
      const x = p % width;
      const y = (p - x) / width;
      let nearCut = false;
      for (let dy = -r2; dy <= r2 && !nearCut; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= height) continue;
        for (let dx = -r2; dx <= r2; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= width) continue;
          if (visited[yy * width + xx]) {
            nearCut = true;
            break;
          }
        }
      }
      if (!nearCut) continue;
      // min >= bgThreshold -> alpha 0; min == featherFloor -> alpha 255.
      const newAlpha = min >= bgThreshold ? 0 : Math.round(255 * ((min - featherFloor) / span));
      if (newAlpha < data[i + 3]) data[i + 3] = newAlpha;
    }
  }

  return { changed: true, clearedPixels: cleared };
}
