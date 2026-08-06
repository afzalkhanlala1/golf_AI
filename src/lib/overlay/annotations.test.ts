import { describe, expect, it } from "vitest";
import {
  angleAt,
  angleFromVertical,
  isComplete,
  simplifyStroke,
  toNormalized,
  toPixels,
} from "./annotations";

const RECT = { left: 100, top: 50, width: 400, height: 800 };

describe("toNormalized", () => {
  it("maps a click to a fraction of the video box", () => {
    expect(toNormalized(300, 450, RECT)).toEqual({ x: 0.5, y: 0.5 });
  });

  it("clamps a drag that leaves the box", () => {
    // Otherwise the stored point draws outside the frame forever.
    expect(toNormalized(-999, -999, RECT)).toEqual({ x: 0, y: 0 });
    expect(toNormalized(9999, 9999, RECT)).toEqual({ x: 1, y: 1 });
  });

  it("survives a resize — the same fraction maps to the new box", () => {
    const p = toNormalized(300, 450, RECT);
    const small = toPixels(p, 200, 400);
    expect(small).toEqual({ x: 100, y: 200 });
  });

  it("does not divide by zero on a collapsed box", () => {
    expect(toNormalized(10, 10, { left: 0, top: 0, width: 0, height: 0 })).toEqual({
      x: 0,
      y: 0,
    });
  });
});

describe("angleAt", () => {
  it("reads a right angle as 90 degrees on a square box", () => {
    const a = { x: 0.5, y: 0.2 };
    const b = { x: 0.5, y: 0.5 };
    const c = { x: 0.8, y: 0.5 };
    expect(angleAt(a, b, c, 500, 500)!).toBeCloseTo(90, 4);
  });

  it("accounts for the aspect ratio of the video", () => {
    // The same normalised points on a portrait clip are NOT the same angle
    // on screen. Measuring in normalised space would report 90 for both.
    const a = { x: 0.5, y: 0.3 };
    const b = { x: 0.5, y: 0.5 };
    const c = { x: 0.7, y: 0.5 };
    const square = angleAt(a, b, c, 500, 500)!;
    const portrait = angleAt(a, b, c, 400, 900)!;
    expect(square).toBeCloseTo(90, 4);
    expect(portrait).toBeCloseTo(90, 4);

    // A non-perpendicular case is where the difference shows up.
    const d = { x: 0.7, y: 0.3 };
    expect(angleAt(a, b, d, 500, 500)).not.toBeCloseTo(
      angleAt(a, b, d, 400, 900)!,
      1,
    );
  });

  it("returns null for a degenerate arm rather than NaN", () => {
    const b = { x: 0.5, y: 0.5 };
    expect(angleAt(b, b, { x: 0.8, y: 0.5 }, 500, 500)).toBeNull();
  });

  it("never exceeds the valid range for acos", () => {
    // Floating point can push the cosine a hair past 1 on collinear points.
    const a = { x: 0.2, y: 0.5 };
    const b = { x: 0.5, y: 0.5 };
    const c = { x: 0.8, y: 0.5 };
    expect(angleAt(a, b, c, 500, 500)!).toBeCloseTo(180, 4);
  });
});

describe("angleFromVertical", () => {
  it("reads a plumb line as zero", () => {
    expect(angleFromVertical({ x: 0.5, y: 0.2 }, { x: 0.5, y: 0.8 }, 400, 800)).toBeCloseTo(0, 6);
  });

  it("reads a horizontal line as 90", () => {
    expect(angleFromVertical({ x: 0.2, y: 0.5 }, { x: 0.8, y: 0.5 }, 400, 800)).toBeCloseTo(90, 6);
  });
});

describe("simplifyStroke", () => {
  it("drops points too close to keep, preserving the ends", () => {
    const dense = Array.from({ length: 200 }, (_, i) => ({ x: i * 0.0001, y: 0 }));
    const out = simplifyStroke(dense);
    expect(out.length).toBeLessThan(dense.length);
    expect(out[0]).toEqual(dense[0]);
    expect(out[out.length - 1]).toEqual(dense[dense.length - 1]);
  });

  it("keeps a stroke that is already sparse", () => {
    const sparse = [
      { x: 0, y: 0 },
      { x: 0.3, y: 0.3 },
      { x: 0.6, y: 0.1 },
    ];
    expect(simplifyStroke(sparse)).toHaveLength(3);
  });

  it("leaves a two-point stroke alone", () => {
    const two = [
      { x: 0, y: 0 },
      { x: 0.0001, y: 0 },
    ];
    expect(simplifyStroke(two)).toHaveLength(2);
  });
});

describe("isComplete", () => {
  it("needs two points for a line and three for an angle", () => {
    const p = { x: 0, y: 0 };
    expect(isComplete("line", [p])).toBe(false);
    expect(isComplete("line", [p, p])).toBe(true);
    expect(isComplete("angle", [p, p])).toBe(false);
    expect(isComplete("angle", [p, p, p])).toBe(true);
  });

  it("never auto-completes a freehand stroke", () => {
    // Freehand ends when the pointer lifts, not at a point count.
    const many = Array.from({ length: 500 }, () => ({ x: 0, y: 0 }));
    expect(isComplete("free", many)).toBe(false);
  });
});
