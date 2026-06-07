import { describe, expect, it } from "vitest";

import { whiteToAlpha } from "../white-to-alpha";

/** Build a w*h RGBA buffer from a per-pixel painter. */
function makeImage(
  width: number,
  height: number,
  paint: (x: number, y: number) => [number, number, number, number]
): Uint8Array {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const [r, g, b, a] = paint(x, y);
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }
  }
  return data;
}

const alphaAt = (data: Uint8Array, width: number, x: number, y: number) =>
  data[(y * width + x) * 4 + 3];

describe("whiteToAlpha", () => {
  it("clears a white background but keeps an opaque centre subject", () => {
    const w = 20;
    const h = 20;
    // White everywhere except a solid red 8x8 block in the middle.
    const data = makeImage(w, h, (x, y) => {
      const inSubject = x >= 6 && x < 14 && y >= 6 && y < 14;
      return inSubject ? [200, 30, 30, 255] : [255, 255, 255, 255];
    });

    const res = whiteToAlpha(data, w, h);

    expect(res.changed).toBe(true);
    expect(res.clearedPixels).toBeGreaterThan(0);
    // Corners (background) -> transparent.
    expect(alphaAt(data, w, 0, 0)).toBe(0);
    expect(alphaAt(data, w, w - 1, h - 1)).toBe(0);
    // Subject centre -> still fully opaque.
    expect(alphaAt(data, w, 10, 10)).toBe(255);
  });

  it("does NOT punch holes through white that is enclosed by the subject", () => {
    const w = 20;
    const h = 20;
    // A red ring with a white hole in the very centre, on a white background.
    const data = makeImage(w, h, (x, y) => {
      const inRing = x >= 5 && x < 15 && y >= 5 && y < 15;
      const inHole = x >= 8 && x < 12 && y >= 8 && y < 12;
      if (inRing && !inHole) return [210, 40, 40, 255];
      return [255, 255, 255, 255];
    });

    whiteToAlpha(data, w, h);

    // Enclosed white hole is NOT connected to the border, so it stays opaque.
    expect(alphaAt(data, w, 10, 10)).toBe(255);
    // Outside white still cleared.
    expect(alphaAt(data, w, 0, 0)).toBe(0);
  });

  it("leaves a non-white (coloured backdrop) image untouched", () => {
    const w = 16;
    const h = 16;
    const data = makeImage(w, h, () => [40, 90, 160, 255]); // solid blue
    const before = data.slice();

    const res = whiteToAlpha(data, w, h);

    expect(res.changed).toBe(false);
    expect(Array.from(data)).toEqual(Array.from(before));
  });

  it("respects the border-coverage gate (mostly-coloured border = skip)", () => {
    const w = 16;
    const h = 16;
    // White interior but a coloured frame around the edge: border is not white.
    const data = makeImage(w, h, (x, y) => {
      const onBorder = x === 0 || y === 0 || x === w - 1 || y === h - 1;
      return onBorder ? [20, 120, 60, 255] : [255, 255, 255, 255];
    });

    const res = whiteToAlpha(data, w, h);
    expect(res.changed).toBe(false);
  });

  it("is a no-op for degenerate dimensions", () => {
    const data = new Uint8Array(0);
    expect(whiteToAlpha(data, 0, 0).changed).toBe(false);
  });
});
