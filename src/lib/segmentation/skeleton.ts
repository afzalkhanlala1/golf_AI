/**
 * Skeleton geometry for the swing overlay — COCO-17 plus real heel/toe
 * foot points (17-20) when the pose backend provides them.
 *
 * Pure functions only — the drawing itself lives in the player component,
 * but everything with a right answer (which bones exist, which region a
 * bone belongs to, where the tracking box goes) is here so it can be tested.
 */

import { KP, type PoseFrame } from "@/lib/metrics/geometry";
import type { BodyPartGroup } from "@/lib/segmentation/body-parts";

export type Bone = {
  a: number;
  b: number;
  group: BodyPartGroup;
};

/**
 * Drawn bones. Face keypoints (eyes/ears) are deliberately excluded — the
 * head is rendered as a single oval instead, which reads far better than a
 * cluster of dots on a face and avoids putting a distracting scribble over
 * the golfer's features.
 */
export const BONES: Bone[] = [
  // Torso
  { a: KP.leftShoulder, b: KP.rightShoulder, group: "torso" },
  { a: KP.leftShoulder, b: KP.leftHip, group: "torso" },
  { a: KP.rightShoulder, b: KP.rightHip, group: "torso" },
  { a: KP.leftHip, b: KP.rightHip, group: "torso" },
  // Arms
  { a: KP.leftShoulder, b: KP.leftElbow, group: "arms" },
  { a: KP.leftElbow, b: KP.leftWrist, group: "arms" },
  { a: KP.rightShoulder, b: KP.rightElbow, group: "arms" },
  { a: KP.rightElbow, b: KP.rightWrist, group: "arms" },
  // Legs
  { a: KP.leftHip, b: KP.leftKnee, group: "legs" },
  { a: KP.leftKnee, b: KP.leftAnkle, group: "legs" },
  { a: KP.rightHip, b: KP.rightKnee, group: "legs" },
  { a: KP.rightKnee, b: KP.rightAnkle, group: "legs" },
  // Feet — only draw when the backend actually observed heel/toe (a
  // COCO-17-only backend leaves these zero-confidence, so isVisible()
  // naturally skips them; see body-parts.ts's module doc for why feet are
  // never approximated past the ankle).
  { a: KP.leftAnkle, b: KP.leftHeel, group: "legs" },
  { a: KP.leftHeel, b: KP.leftToe, group: "legs" },
  { a: KP.rightAnkle, b: KP.rightHeel, group: "legs" },
  { a: KP.rightHeel, b: KP.rightToe, group: "legs" },
];

/** Joints drawn as dots — face points excluded, see BONES. */
export const JOINTS = [
  KP.leftShoulder,
  KP.rightShoulder,
  KP.leftElbow,
  KP.rightElbow,
  KP.leftWrist,
  KP.rightWrist,
  KP.leftHip,
  KP.rightHip,
  KP.leftKnee,
  KP.rightKnee,
  KP.leftAnkle,
  KP.rightAnkle,
  KP.leftHeel,
  KP.leftToe,
  KP.rightHeel,
  KP.rightToe,
];

/** Bigger dots for the joints a coach actually reads. */
export const MAJOR_JOINTS = new Set<number>([
  KP.leftShoulder,
  KP.rightShoulder,
  KP.leftHip,
  KP.rightHip,
  KP.leftKnee,
  KP.rightKnee,
]);

export const MIN_DRAW_CONFIDENCE = 0.25;

export function isVisible(frame: PoseFrame, i: number): boolean {
  const k = frame?.[i];
  return !!k && k.c >= MIN_DRAW_CONFIDENCE && Number.isFinite(k.x) && Number.isFinite(k.y);
}

export type Box = { x1: number; y1: number; x2: number; y2: number };

/**
 * Padded bounding box around the visible keypoints — drives the corner
 * brackets. Returns null when too few points are visible to place a
 * meaningful box (golfer out of frame, or tracking lost), so the caller
 * draws nothing rather than a box collapsed on the origin.
 */
export function trackingBox(
  frame: PoseFrame,
  width: number,
  height: number,
  padFrac = 0.08,
): Box | null {
  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < frame.length; i++) {
    if (isVisible(frame, i)) pts.push({ x: frame[i]!.x, y: frame[i]!.y });
  }
  if (pts.length < 4) return null;

  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  for (const p of pts) {
    x1 = Math.min(x1, p.x);
    y1 = Math.min(y1, p.y);
    x2 = Math.max(x2, p.x);
    y2 = Math.max(y2, p.y);
  }

  const padX = (x2 - x1) * padFrac;
  const padY = (y2 - y1) * padFrac;
  return {
    x1: Math.max(0, x1 - padX),
    y1: Math.max(0, y1 - padY),
    x2: Math.min(width, x2 + padX),
    y2: Math.min(height, y2 + padY),
  };
}

/**
 * Head oval from the nose plus shoulder span. The nose alone gives position
 * but no scale, so the radius is derived from shoulder width and the centre
 * is nudged up the torso axis — a nose-centred circle sits too low and
 * covers the chin rather than the head.
 */
export function headOval(
  frame: PoseFrame,
): { cx: number; cy: number; rx: number; ry: number } | null {
  if (!isVisible(frame, KP.nose)) return null;
  const nose = frame[KP.nose]!;

  let scale = 0;
  if (isVisible(frame, KP.leftShoulder) && isVisible(frame, KP.rightShoulder)) {
    const ls = frame[KP.leftShoulder]!;
    const rs = frame[KP.rightShoulder]!;
    scale = Math.hypot(ls.x - rs.x, ls.y - rs.y);
    const midShoulderY = (ls.y + rs.y) / 2;
    // Push the centre away from the shoulders, along the neck.
    const lift = Math.sign(nose.y - midShoulderY) * scale * 0.1;
    return {
      cx: nose.x,
      cy: nose.y + lift,
      rx: scale * 0.28,
      ry: scale * 0.34,
    };
  }
  return null;
}

/** Human-readable event label, e.g. "mid_backswing" → "MID-BACKSWING". */
export function eventLabel(event: string): string {
  return event.replaceAll("_", "-").toUpperCase();
}

/**
 * Which event, if any, this frame sits on — within `tolerance` frames so a
 * label is readable during playback instead of flashing for one frame.
 */
export function eventAtFrame(
  events: Array<{ event: string; frame: number }>,
  frame: number,
  tolerance = 2,
): string | null {
  let best: { event: string; d: number } | null = null;
  for (const e of events) {
    const d = Math.abs(e.frame - frame);
    if (d <= tolerance && (!best || d < best.d)) best = { event: e.event, d };
  }
  return best ? best.event : null;
}
