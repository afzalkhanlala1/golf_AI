import { describe, expect, it } from "vitest";
import { extendLine, fitPlaneLine, type TrailLike } from "./plane";

/** Points along a line through (cx, cy) at `deg` from vertical. */
function linePoints(
  cx: number,
  cy: number,
  deg: number,
  n = 20,
  jitter = 0,
): TrailLike[] {
  const rad = (deg * Math.PI) / 180;
  const ux = Math.sin(rad);
  const uy = Math.cos(rad);
  return Array.from({ length: n }, (_, i) => {
    const t = (i - n / 2) * 5;
    // Deterministic wobble so the test is repeatable.
    const w = jitter * Math.sin(i * 2.3);
    return { f: i, x: cx + ux * t - uy * w, y: cy + uy * t + ux * w };
  });
}

describe("fitPlaneLine", () => {
  it("recovers the angle of a clean line", () => {
    for (const deg of [0, 15, 35, 55, 80]) {
      const fit = fitPlaneLine(linePoints(300, 400, deg), 0, 100)!;
      expect(fit.angleFromVertical).toBeCloseTo(deg, 3);
    }
  });

  it("handles a perfectly vertical path", () => {
    // Least squares of y on x diverges here; orthogonal regression does not.
    const vertical: TrailLike[] = Array.from({ length: 10 }, (_, i) => ({
      f: i,
      x: 250,
      y: 100 + i * 10,
    }));
    const fit = fitPlaneLine(vertical, 0, 100)!;
    expect(fit.angleFromVertical).toBeCloseTo(0, 6);
    expect(Number.isFinite(fit.a.x)).toBe(true);
    expect(fit.rmsPx).toBeCloseTo(0, 6);
  });

  it("handles a perfectly horizontal path", () => {
    const horizontal: TrailLike[] = Array.from({ length: 10 }, (_, i) => ({
      f: i,
      x: 100 + i * 10,
      y: 250,
    }));
    expect(fitPlaneLine(horizontal, 0, 100)!.angleFromVertical).toBeCloseTo(90, 6);
  });

  it("reports scatter as rms and stays close on a noisy path", () => {
    const clean = fitPlaneLine(linePoints(300, 400, 45, 30, 0), 0, 100)!;
    const noisy = fitPlaneLine(linePoints(300, 400, 45, 30, 6), 0, 100)!;
    expect(clean.rmsPx).toBeCloseTo(0, 6);
    expect(noisy.rmsPx).toBeGreaterThan(1);
    // The fit itself should still land near the true angle.
    expect(noisy.angleFromVertical).toBeCloseTo(45, 0);
  });

  it("only fits the requested frame window", () => {
    // Backswing at one angle, downswing at another. Fitting everything
    // would average the two into a line describing neither.
    const back = linePoints(300, 400, 70, 12).map((p, i) => ({ ...p, f: i }));
    const down = linePoints(300, 400, 20, 12).map((p, i) => ({ ...p, f: 100 + i }));
    const fit = fitPlaneLine([...back, ...down], 100, 200)!;
    expect(fit.angleFromVertical).toBeCloseTo(20, 2);
    expect(fit.samples).toBe(12);
  });

  it("refuses to fit too few points", () => {
    expect(fitPlaneLine(linePoints(300, 400, 30, 3), 0, 100)).toBeNull();
    expect(fitPlaneLine([], 0, 100)).toBeNull();
  });

  it("refuses a path that never moved", () => {
    const still: TrailLike[] = Array.from({ length: 10 }, (_, i) => ({
      f: i,
      x: 200,
      y: 200,
    }));
    expect(fitPlaneLine(still, 0, 100)).toBeNull();
  });

  it("folds direction so mirrored leans read the same steepness", () => {
    const left = fitPlaneLine(linePoints(300, 400, 30), 0, 100)!;
    const right = fitPlaneLine(linePoints(300, 400, -30), 0, 100)!;
    expect(left.angleFromVertical).toBeCloseTo(right.angleFromVertical, 4);
  });
});

describe("extendLine", () => {
  it("keeps the same direction while spanning past the frame", () => {
    const fit = fitPlaneLine(linePoints(300, 400, 30), 0, 100)!;
    const ext = extendLine(fit, 480, 848);

    const dirOf = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.atan2(b.y - a.y, b.x - a.x);
    expect(Math.abs(dirOf(ext.a, ext.b) - dirOf(fit.a, fit.b))).toBeLessThan(1e-6);

    const length = Math.hypot(ext.b.x - ext.a.x, ext.b.y - ext.a.y);
    expect(length).toBeGreaterThan(Math.hypot(480, 848));
  });
});
