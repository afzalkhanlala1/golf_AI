/**
 * COCO-17 keypoint indices, plus 4 foot points appended at 17-20.
 *
 * The extra 4 are real landmarks (heel + toe per side), not a geometric
 * guess extrapolated past the ankle — MediaPipe's native 33-point output
 * already includes them (indices 29-32), we were just discarding them in
 * the COCO mapping. RTMPose's plain Body model does not emit feet, so on
 * that backend these come back zero-confidence and are omitted exactly
 * like any other unobserved joint — missing is honest, wrong is not.
 *
 * Appended rather than inserted so every existing 0-16 index, and every
 * fixture/consumer that only knows about 17 points, stays valid unchanged.
 */
export const KP = {
  nose: 0,
  leftShoulder: 5,
  rightShoulder: 6,
  leftElbow: 7,
  rightElbow: 8,
  leftWrist: 9,
  rightWrist: 10,
  leftHip: 11,
  rightHip: 12,
  leftKnee: 13,
  rightKnee: 14,
  leftAnkle: 15,
  rightAnkle: 16,
  leftHeel: 17,
  leftToe: 18,
  rightHeel: 19,
  rightToe: 20,
} as const;

export type Keypoint = { x: number; y: number; c: number };
export type PoseFrame = Keypoint[];

export function mid(a: Keypoint, b: Keypoint): Keypoint {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, c: Math.min(a.c, b.c) };
}

export function dist(a: Keypoint, b: Keypoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Angle of vector a→b vs vertical down, in degrees. Positive = lean right. */
export function angleFromVertical(a: Keypoint, b: Keypoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  // vertical down is (0, 1); atan2(dx, dy) gives deviation from vertical
  return (Math.atan2(dx, dy) * 180) / Math.PI;
}

/** Absolute angle between three points at vertex b, in degrees. */
export function jointAngle(a: Keypoint, b: Keypoint, c: Keypoint): number {
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const mag = Math.hypot(ab.x, ab.y) * Math.hypot(cb.x, cb.y);
  if (mag === 0) return 0;
  const cos = Math.min(1, Math.max(-1, dot / mag));
  return (Math.acos(cos) * 180) / Math.PI;
}

/** Line inclination vs horizontal, degrees. */
export function lineInclination(a: Keypoint, b: Keypoint): number {
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}

export function shoulderWidth(frame: PoseFrame): number {
  return dist(frame[KP.leftShoulder], frame[KP.rightShoulder]);
}

export function hipWidth(frame: PoseFrame): number {
  return dist(frame[KP.leftHip], frame[KP.rightHip]);
}

export function stanceWidth(frame: PoseFrame): number {
  return dist(frame[KP.leftAnkle], frame[KP.rightAnkle]);
}

export function midShoulder(frame: PoseFrame): Keypoint {
  return mid(frame[KP.leftShoulder], frame[KP.rightShoulder]);
}

export function midHip(frame: PoseFrame): Keypoint {
  return mid(frame[KP.leftHip], frame[KP.rightHip]);
}
