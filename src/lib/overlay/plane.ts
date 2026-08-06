/**
 * Fitting a swing plane line to a motion path.
 *
 * ## What "plane" means here, and what it does not
 *
 * A true swing plane is the plane the *clubhead* travels on. That needs the
 * club tracked, which needs 60fps or better. On an ordinary 30fps clip the
 * club is not trackable, so the honest substitute is the plane the *hands*
 * travel on — measured from wrist landmarks, which the pose model reports
 * on every frame regardless of frame rate.
 *
 * These are genuinely different lines. The hands travel on a steeper, more
 * inside path than the clubhead, and the two are typically 10–20 degrees
 * apart. Calling a hand plane a swing plane would be a quiet lie, so the
 * caller labels them separately and this module only fits whatever path it
 * is handed.
 *
 * ## Why orthogonal regression rather than least squares
 *
 * A downswing path is steep — often within a few degrees of vertical. The
 * ordinary least-squares fit of y against x assumes error only in y and
 * blows up as the line approaches vertical, where a tiny horizontal spread
 * implies an enormous slope. Orthogonal (total least-squares) regression
 * minimises perpendicular distance instead, has no preferred axis, and
 * handles a perfectly vertical path without special-casing it.
 *
 * That is not a theoretical concern: the downswing is exactly the region
 * where the path is steepest, and it is the region a plane line is for.
 */

import type { Pt } from "./annotations";

export type TrailLike = { f: number; x: number; y: number };

export type PlaneFit = {
  /** Two points spanning the fitted line, in image pixels. */
  a: Pt;
  b: Pt;
  /** Degrees from vertical. 0 is plumb; larger is flatter. */
  angleFromVertical: number;
  /** How tightly the path hugged the line, in pixels (RMS perpendicular). */
  rmsPx: number;
  samples: number;
};

/**
 * Fit a line to the portion of a path between two frames.
 *
 * The window matters: a plane line is meaningful over the downswing, where
 * the club is travelling on something close to a plane. Fitting the whole
 * swing would average the backswing and follow-through into it and produce
 * a line that describes neither.
 */
export function fitPlaneLine(
  points: TrailLike[],
  fromFrame: number,
  toFrame: number,
): PlaneFit | null {
  const pts = points.filter((p) => p.f >= fromFrame && p.f <= toFrame);
  if (pts.length < 4) return null;

  const n = pts.length;
  const mx = pts.reduce((s, p) => s + p.x, 0) / n;
  const my = pts.reduce((s, p) => s + p.y, 0) / n;

  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const p of pts) {
    const dx = p.x - mx;
    const dy = p.y - my;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }

  if (sxx + syy < 1e-9) return null; // every point identical

  // Principal axis: the eigenvector of the covariance matrix with the
  // larger eigenvalue. This is the direction of greatest spread, which is
  // the line the points lie along.
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const ux = Math.cos(theta);
  const uy = Math.sin(theta);

  // Extent along that axis, so the drawn segment spans the actual path
  // rather than an arbitrary fixed length.
  let tMin = Infinity;
  let tMax = -Infinity;
  let sumSq = 0;
  for (const p of pts) {
    const dx = p.x - mx;
    const dy = p.y - my;
    const t = dx * ux + dy * uy;
    const perp = -dx * uy + dy * ux;
    sumSq += perp * perp;
    if (t < tMin) tMin = t;
    if (t > tMax) tMax = t;
  }

  const a = { x: mx + ux * tMin, y: my + uy * tMin };
  const b = { x: mx + ux * tMax, y: my + uy * tMax };

  // Direction is sign-agnostic, so fold to a 0–90 reading: a plane leaning
  // left and one leaning right by the same amount are the same steepness.
  let deg = Math.abs((Math.atan2(ux, uy) * 180) / Math.PI);
  if (deg > 90) deg = 180 - deg;

  return {
    a,
    b,
    angleFromVertical: deg,
    rmsPx: Math.sqrt(sumSq / n),
    samples: n,
  };
}

/**
 * Extend a fitted segment to span the frame.
 *
 * Coaches draw plane lines running off the edge of the picture — the line
 * is a reference to judge the whole swing against, not a measurement of the
 * segment it was fitted to.
 */
export function extendLine(
  fit: PlaneFit,
  width: number,
  height: number,
): { a: Pt; b: Pt } {
  const dx = fit.b.x - fit.a.x;
  const dy = fit.b.y - fit.a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return { a: fit.a, b: fit.b };

  const ux = dx / len;
  const uy = dy / len;
  const reach = Math.hypot(width, height);
  const cx = (fit.a.x + fit.b.x) / 2;
  const cy = (fit.a.y + fit.b.y) / 2;

  return {
    a: { x: cx - ux * reach, y: cy - uy * reach },
    b: { x: cx + ux * reach, y: cy + uy * reach },
  };
}
