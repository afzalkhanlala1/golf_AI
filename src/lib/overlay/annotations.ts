/**
 * Drawing on a swing video.
 *
 * ## Why coordinates are normalised
 *
 * Annotations are stored as fractions of the video box (0–1), never as
 * pixels. A drawn line means "along the shaft" or "down the spine" — it is
 * anchored to the *picture*, not to the screen. Store pixels and the line
 * slides off the golfer the moment the window resizes, the video goes
 * fullscreen, or the same clip is opened on a phone. Normalised points
 * survive all of that, and converting back is one multiply at draw time.
 *
 * ## Why angle is three points, not two lines
 *
 * A golfer measuring shaft lean or spine angle puts the vertex on a joint
 * and the arms along two segments. Storing it as a vertex plus two rays
 * means the reading is defined by the same points that are drawn — there is
 * no separate "which lines did I mean" state to get out of sync.
 */

export type Pt = { x: number; y: number };

export type Annotation =
  | { id: string; kind: "line"; color: string; points: Pt[] }
  | { id: string; kind: "angle"; color: string; points: Pt[] }
  | { id: string; kind: "free"; color: string; points: Pt[] };

export type Tool = "line" | "angle" | "free";

/** How many points each tool collects before the shape is finished. */
export const POINTS_REQUIRED: Record<Tool, number> = {
  line: 2,
  angle: 3,
  free: Infinity,
};

export function toNormalized(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): Pt {
  if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
  return {
    // Clamped: a drag that leaves the video box should stop at the edge
    // rather than storing a point that draws outside the frame forever.
    x: clamp01((clientX - rect.left) / rect.width),
    y: clamp01((clientY - rect.top) / rect.height),
  };
}

export function toPixels(p: Pt, width: number, height: number): Pt {
  return { x: p.x * width, y: p.y * height };
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/**
 * Interior angle at `b`, in degrees.
 *
 * Computed in *pixel* space, not normalised space. A normalised box is
 * anisotropic whenever the video is not square — one unit of x is a
 * different number of real pixels than one unit of y — so measuring the
 * angle there would report something that is not the angle on screen. A
 * shaft drawn at a visible 45° would read as something else entirely on a
 * portrait clip.
 */
export function angleAt(a: Pt, b: Pt, c: Pt, width: number, height: number): number | null {
  const ax = (a.x - b.x) * width;
  const ay = (a.y - b.y) * height;
  const cx = (c.x - b.x) * width;
  const cy = (c.y - b.y) * height;

  const magA = Math.hypot(ax, ay);
  const magC = Math.hypot(cx, cy);
  if (magA < 1e-6 || magC < 1e-6) return null;

  const cos = (ax * cx + ay * cy) / (magA * magC);
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
}

/** Angle of a line from vertical, in degrees — how shaft lean is read. */
export function angleFromVertical(a: Pt, b: Pt, width: number, height: number): number {
  const dx = (b.x - a.x) * width;
  const dy = (b.y - a.y) * height;
  return Math.abs((Math.atan2(dx, dy) * 180) / Math.PI);
}

/**
 * Thin out a freehand stroke.
 *
 * A pointer event fires far more often than a stroke has shape, so a short
 * drag can carry hundreds of near-identical points. Dropping any point
 * within `minDist` of the last kept one leaves the curve visually identical
 * while keeping the stored annotation small enough to serialise.
 */
export function simplifyStroke(points: Pt[], minDist = 0.004): Pt[] {
  if (points.length <= 2) return points;
  const out: Pt[] = [points[0]!];
  for (const p of points.slice(1, -1)) {
    const last = out[out.length - 1]!;
    if (Math.hypot(p.x - last.x, p.y - last.y) >= minDist) out.push(p);
  }
  out.push(points[points.length - 1]!);
  return out;
}

export function isComplete(kind: Tool, points: Pt[]): boolean {
  return points.length >= POINTS_REQUIRED[kind];
}
