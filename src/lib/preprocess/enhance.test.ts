import { describe, expect, it, beforeAll } from "vitest";
import { describeOutcome, interpolateFrame, sharpen, type ClipProbe } from "./enhance";

// ImageData isn't defined in the node test environment.
beforeAll(() => {
  if (typeof globalThis.ImageData === "undefined") {
    class PolyfillImageData {
      data: Uint8ClampedArray;
      width: number;
      height: number;
      constructor(a: Uint8ClampedArray | number, b: number, c?: number) {
        if (typeof a === "number") {
          this.width = a;
          this.height = b;
          this.data = new Uint8ClampedArray(a * b * 4);
        } else {
          this.data = a;
          this.width = b;
          this.height = c!;
        }
      }
    }
    // @ts-expect-error test polyfill
    globalThis.ImageData = PolyfillImageData;
  }
});

function solid(w: number, h: number, v: number): ImageData {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < d.length; i += 4) {
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
    d[i + 3] = 255;
  }
  return new ImageData(d, w, h);
}

/** A vertical edge at column `edgeX`. */
function edgeImage(w: number, h: number, edgeX: number): ImageData {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const v = x < edgeX ? 60 : 190;
      d[i] = v;
      d[i + 1] = v;
      d[i + 2] = v;
      d[i + 3] = 255;
    }
  }
  return new ImageData(d, w, h);
}

/** A white square at (sx, sy). */
function squareImage(w: number, h: number, sx: number, sy: number, size = 16): ImageData {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const inside = x >= sx && x < sx + size && y >= sy && y < sy + size;
      const v = inside ? 240 : 20;
      d[i] = v;
      d[i + 1] = v;
      d[i + 2] = v;
      d[i + 3] = 255;
    }
  }
  return new ImageData(d, w, h);
}

function pixel(img: ImageData, x: number, y: number): number {
  return img.data[(y * img.width + x) * 4]!;
}

describe("sharpen", () => {
  it("is a no-op at amount 0", () => {
    const src = edgeImage(16, 16, 8);
    expect(sharpen(src, 0)).toBe(src);
  });

  it("increases contrast across an edge", () => {
    const src = edgeImage(32, 32, 16);
    const out = sharpen(src, 1.0);
    // Just left of the edge gets darker, just right gets brighter.
    const beforeGap = pixel(src, 16, 16) - pixel(src, 15, 16);
    const afterGap = pixel(out, 16, 16) - pixel(out, 15, 16);
    expect(afterGap).toBeGreaterThan(beforeGap);
  });

  it("leaves a flat region essentially untouched", () => {
    const src = solid(16, 16, 128);
    const out = sharpen(src, 1.0);
    // No edge means nothing to enhance — no invented texture.
    expect(pixel(out, 8, 8)).toBe(128);
  });

  it("never produces out-of-range channel values", () => {
    const out = sharpen(edgeImage(24, 24, 12), 5.0);
    for (let i = 0; i < out.data.length; i++) {
      expect(out.data[i]).toBeGreaterThanOrEqual(0);
      expect(out.data[i]).toBeLessThanOrEqual(255);
    }
  });
});

describe("interpolateFrame", () => {
  it("reproduces the endpoints at t=0 and t=1 (blend mode)", () => {
    const a = solid(8, 8, 40);
    const b = solid(8, 8, 200);
    expect(pixel(interpolateFrame(a, b, 0, false), 4, 4)).toBe(40);
    expect(pixel(interpolateFrame(a, b, 1, false), 4, 4)).toBe(200);
  });

  it("blends halfway at t=0.5", () => {
    const out = interpolateFrame(solid(8, 8, 40), solid(8, 8, 200), 0.5, false);
    expect(pixel(out, 4, 4)).toBeCloseTo(120, 0);
  });

  it("places a moving object between its two positions, not ghosted at both", () => {
    // Square moves 16px right between frames; the midpoint frame should
    // show it at +8, with the two endpoints comparatively empty.
    const prev = squareImage(96, 48, 16, 16);
    const next = squareImage(96, 48, 32, 16);
    const mid = interpolateFrame(prev, next, 0.5, true);

    const atMiddle = pixel(mid, 8 + 16 + 4, 24); // ~x=28, inside the shifted square
    const atStart = pixel(mid, 18, 24);
    const atEnd = pixel(mid, 44, 24);

    expect(atMiddle).toBeGreaterThan(150);
    // Motion compensation should beat a naive blend, which would show the
    // square at BOTH endpoints at half intensity.
    expect(atMiddle).toBeGreaterThan(atStart);
    expect(atMiddle).toBeGreaterThan(atEnd);
  });

  it("output dimensions always match the inputs", () => {
    const out = interpolateFrame(solid(20, 12, 10), solid(20, 12, 90), 0.5, true);
    expect(out.width).toBe(20);
    expect(out.height).toBe(12);
  });
});

describe("describeOutcome", () => {
  const probe = (over: Partial<ClipProbe> = {}): ClipProbe => ({
    width: 160,
    height: 160,
    durationSec: 7.5,
    estimatedFps: 30,
    frameCountEstimate: 225,
    ...over,
  });

  it("warns that upscaling a tiny clip recovers no real detail", () => {
    const { caveats } = describeOutcome(probe(), {
      sharpenAmount: 1,
      upscale: 4,
      interpolateFactor: 0,
      motionCompensated: true,
    });
    expect(caveats.join(" ")).toMatch(/recovers no real detail/i);
  });

  it("warns that interpolated impact must not be measured", () => {
    const { caveats } = describeOutcome(probe(), {
      sharpenAmount: 0,
      upscale: 1,
      interpolateFactor: 3,
      motionCompensated: true,
    });
    // This caveat is the whole point — smoother playback is not more data.
    expect(caveats.join(" ")).toMatch(/do not read impact measurements off it/i);
  });

  it("does not raise the low-fps caveat for genuine slow-motion", () => {
    const { caveats } = describeOutcome(probe({ estimatedFps: 240 }), {
      sharpenAmount: 0,
      upscale: 1,
      interpolateFactor: 1,
      motionCompensated: true,
    });
    expect(caveats.join(" ")).not.toMatch(/do not read impact/i);
  });

  it("reports the resulting framerate", () => {
    const { improvements } = describeOutcome(probe({ estimatedFps: 30 }), {
      sharpenAmount: 0,
      upscale: 1,
      interpolateFactor: 3,
      motionCompensated: true,
    });
    expect(improvements.join(" ")).toContain("120fps");
  });
});
