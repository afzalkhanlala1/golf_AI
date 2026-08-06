/**
 * Keypoint-anchored body-part segmentation.
 *
 * Partitions the golfer into named regions (head, back, pelvis, arms, legs,
 * feet) derived from the pose we already compute — no extra model, no extra
 * GPU pass, and no licence exposure.
 *
 * FEET ARE REAL LANDMARKS, NOT A GUESS. Unlike every other region here
 * (which is a bone thickened by an assumed width, since COCO-17 gives no
 * limb width), the foot region is a triangle built from three actual
 * observed points — ankle, heel, toe — because the pose pipeline now emits
 * heel/toe when the backend provides them (MediaPipe does; a plain
 * COCO-17-only backend like RTMPose's Body model does not, and the foot
 * region simply won't materialise on that backend — omitted, not guessed).
 * Foot orientation and lateral weight distribution are real coaching
 * signals (weight staying on the trail foot too long, toe flare at
 * address), which is why this one was worth the real landmarks rather than
 * a shin extended past the ankle by an assumed length.
 *
 * WHY NOT A PIXEL-SEGMENTATION MODEL: the obvious candidates for true
 * per-pixel body-part masks are licensed non-commercially — Meta's Sapiens
 * (28-class body-part segmentation) is CC BY-NC 4.0, and DensePose's weights
 * are likewise non-commercial. Neither can ship in a paid product. Regions
 * derived from permissively-licensed pose (RTMPose, Apache-2.0) stay clean.
 * The upgrade path, if pixel-accurate masks are ever needed, is SAM
 * (Apache-2.0) prompted with these same keypoints — see docs in the lab UI.
 *
 * Coordinates are in the same space as the input keypoints (image pixels).
 */

import { KP, type Keypoint, type PoseFrame } from "@/lib/metrics/geometry";

export type BodyPartId =
  | "head"
  | "back"
  | "pelvis"
  | "left_upper_arm"
  | "right_upper_arm"
  | "left_forearm"
  | "right_forearm"
  | "left_thigh"
  | "right_thigh"
  | "left_shin"
  | "right_shin"
  | "left_foot"
  | "right_foot";

export type BodyPartGroup = "head" | "torso" | "arms" | "legs";

export type Point = { x: number; y: number };

export type BodyPartRegion = {
  id: BodyPartId;
  label: string;
  group: BodyPartGroup;
  /** Closed polygon in image coordinates. */
  polygon: Point[];
  centroid: Point;
  /** Min confidence of the keypoints this region was built from. */
  confidence: number;
};

export const PART_META: Record<
  BodyPartId,
  { label: string; group: BodyPartGroup }
> = {
  head: { label: "Head", group: "head" },
  back: { label: "Back / torso", group: "torso" },
  pelvis: { label: "Hips / pelvis", group: "torso" },
  left_upper_arm: { label: "Left upper arm", group: "arms" },
  right_upper_arm: { label: "Right upper arm", group: "arms" },
  left_forearm: { label: "Left forearm", group: "arms" },
  right_forearm: { label: "Right forearm", group: "arms" },
  left_thigh: { label: "Left thigh", group: "legs" },
  right_thigh: { label: "Right thigh", group: "legs" },
  left_shin: { label: "Left shin", group: "legs" },
  right_shin: { label: "Right shin", group: "legs" },
  left_foot: { label: "Left foot", group: "legs" },
  right_foot: { label: "Right foot", group: "legs" },
};

/**
 * Group colours. Validated for CVD separation via the dataviz palette
 * checker (adjacent-pair ΔE clears the floor in both light and dark).
 */
export const GROUP_COLORS: Record<BodyPartGroup, string> = {
  head: "#b8791f",
  torso: "#1f7a52",
  arms: "#3f6fa8",
  legs: "#c0512f",
};

const MIN_CONFIDENCE = 0.15;

function valid(k: Keypoint | undefined): k is Keypoint {
  return !!k && Number.isFinite(k.x) && Number.isFinite(k.y) && k.c >= MIN_CONFIDENCE;
}

function centroidOf(polygon: Point[]): Point {
  if (polygon.length === 0) return { x: 0, y: 0 };
  let x = 0;
  let y = 0;
  for (const p of polygon) {
    x += p.x;
    y += p.y;
  }
  return { x: x / polygon.length, y: y / polygon.length };
}

/**
 * Quad around the segment a→b, tapering from widthA to widthB. This is the
 * limb primitive: a bone thickened perpendicular to its own axis, so it
 * rotates with the limb instead of staying axis-aligned.
 */
function limbQuad(
  a: Keypoint,
  b: Keypoint,
  widthA: number,
  widthB: number,
): Point[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) {
    // Degenerate bone (joints coincident) — emit a small square so the
    // region still exists rather than collapsing to an invisible line.
    const r = Math.max(widthA, widthB) / 2;
    return [
      { x: a.x - r, y: a.y - r },
      { x: a.x + r, y: a.y - r },
      { x: a.x + r, y: a.y + r },
      { x: a.x - r, y: a.y + r },
    ];
  }
  // Unit perpendicular to the bone axis.
  const px = -dy / len;
  const py = dx / len;
  const ha = widthA / 2;
  const hb = widthB / 2;
  return [
    { x: a.x + px * ha, y: a.y + py * ha },
    { x: b.x + px * hb, y: b.y + py * hb },
    { x: b.x - px * hb, y: b.y - py * hb },
    { x: a.x - px * ha, y: a.y - py * ha },
  ];
}

/**
 * Foot polygon from three real observed points: ankle, heel, toe. Widened
 * slightly perpendicular to the heel-toe line so it reads as a foot shape
 * on screen rather than a hairline triangle, but the three vertices
 * themselves are never invented.
 */
function footPolygon(ankle: Keypoint, heel: Keypoint, toe: Keypoint, scale: number): Point[] {
  const dx = toe.x - heel.x;
  const dy = toe.y - heel.y;
  const len = Math.hypot(dx, dy) || 1;
  const px = (-dy / len) * scale * 0.06;
  const py = (dx / len) * scale * 0.06;
  return [
    { x: ankle.x, y: ankle.y },
    { x: heel.x + px, y: heel.y + py },
    { x: toe.x + px, y: toe.y + py },
    { x: toe.x - px, y: toe.y - py },
    { x: heel.x - px, y: heel.y - py },
  ];
}

function ellipse(center: Point, rx: number, ry: number, steps = 16): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    pts.push({ x: center.x + Math.cos(t) * rx, y: center.y + Math.sin(t) * ry });
  }
  return pts;
}

function lerp(a: Keypoint, b: Keypoint, t: number): Keypoint {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    c: Math.min(a.c, b.c),
  };
}

function push(
  out: BodyPartRegion[],
  id: BodyPartId,
  polygon: Point[],
  confidence: number,
) {
  const meta = PART_META[id];
  out.push({
    id,
    label: meta.label,
    group: meta.group,
    polygon,
    centroid: centroidOf(polygon),
    confidence: Math.max(0, Math.min(1, confidence)),
  });
}

/**
 * Build body-part regions for a single pose frame.
 *
 * Regions whose anchoring keypoints are missing or below the confidence
 * floor are omitted entirely — a missing limb is honest, a guessed one is
 * not (same rule the metrics pipeline follows).
 */
export function segmentBodyParts(frame: PoseFrame): BodyPartRegion[] {
  const out: BodyPartRegion[] = [];
  if (!frame || frame.length < 17) return out;

  const ls = frame[KP.leftShoulder];
  const rs = frame[KP.rightShoulder];
  const lh = frame[KP.leftHip];
  const rh = frame[KP.rightHip];

  // Scale everything off shoulder width so regions are resolution-independent
  // (monocular video has no absolute scale — same constraint as the metrics).
  let scale = 0;
  if (valid(ls) && valid(rs)) scale = Math.hypot(ls.x - rs.x, ls.y - rs.y);
  if (scale < 1e-6 && valid(lh) && valid(rh)) {
    scale = Math.hypot(lh.x - rh.x, lh.y - rh.y) * 1.3;
  }
  if (scale < 1e-6) return out;

  // Head — ellipse anchored on the nose, sized off shoulder width.
  const nose = frame[KP.nose];
  if (valid(nose)) {
    push(out, "head", ellipse({ x: nose.x, y: nose.y }, scale * 0.3, scale * 0.36), nose.c);
  }

  // Back / torso — shoulder line down to the hip line.
  if (valid(ls) && valid(rs) && valid(lh) && valid(rh)) {
    // Stop just above the hip line so the pelvis band reads as its own region.
    const lhUpper = lerp(ls, lh, 0.86);
    const rhUpper = lerp(rs, rh, 0.86);
    push(
      out,
      "back",
      [
        { x: ls.x, y: ls.y },
        { x: rs.x, y: rs.y },
        { x: rhUpper.x, y: rhUpper.y },
        { x: lhUpper.x, y: lhUpper.y },
      ],
      Math.min(ls.c, rs.c, lh.c, rh.c),
    );
  }

  // Pelvis — band centred on the hip line, extending toward the knees.
  if (valid(lh) && valid(rh)) {
    const lk = frame[KP.leftKnee];
    const rk = frame[KP.rightKnee];
    const drop = valid(lk) && valid(rk) ? 0.28 : 0.22;
    const lLow = valid(lk) ? lerp(lh, lk, drop) : { x: lh.x, y: lh.y + scale * 0.25, c: lh.c };
    const rLow = valid(rk) ? lerp(rh, rk, drop) : { x: rh.x, y: rh.y + scale * 0.25, c: rh.c };
    const lUp = valid(ls) ? lerp(lh, ls, 0.14) : { x: lh.x, y: lh.y - scale * 0.12, c: lh.c };
    const rUp = valid(rs) ? lerp(rh, rs, 0.14) : { x: rh.x, y: rh.y - scale * 0.12, c: rh.c };
    push(
      out,
      "pelvis",
      [
        { x: lUp.x, y: lUp.y },
        { x: rUp.x, y: rUp.y },
        { x: rLow.x, y: rLow.y },
        { x: lLow.x, y: lLow.y },
      ],
      Math.min(lh.c, rh.c),
    );
  }

  // Limbs — tapered quads along each bone.
  const limbs: Array<{
    id: BodyPartId;
    a: number;
    b: number;
    wa: number;
    wb: number;
  }> = [
    { id: "left_upper_arm", a: KP.leftShoulder, b: KP.leftElbow, wa: 0.2, wb: 0.16 },
    { id: "right_upper_arm", a: KP.rightShoulder, b: KP.rightElbow, wa: 0.2, wb: 0.16 },
    { id: "left_forearm", a: KP.leftElbow, b: KP.leftWrist, wa: 0.16, wb: 0.11 },
    { id: "right_forearm", a: KP.rightElbow, b: KP.rightWrist, wa: 0.16, wb: 0.11 },
    { id: "left_thigh", a: KP.leftHip, b: KP.leftKnee, wa: 0.27, wb: 0.2 },
    { id: "right_thigh", a: KP.rightHip, b: KP.rightKnee, wa: 0.27, wb: 0.2 },
    { id: "left_shin", a: KP.leftKnee, b: KP.leftAnkle, wa: 0.2, wb: 0.13 },
    { id: "right_shin", a: KP.rightKnee, b: KP.rightAnkle, wa: 0.2, wb: 0.13 },
  ];

  for (const limb of limbs) {
    const a = frame[limb.a];
    const b = frame[limb.b];
    if (!valid(a) || !valid(b)) continue;
    push(
      out,
      limb.id,
      limbQuad(a, b, scale * limb.wa, scale * limb.wb),
      Math.min(a.c, b.c),
    );
  }

  // Feet — only materialise on a backend that actually observed heel/toe
  // (see module docstring). frame.length check keeps this a no-op against
  // any 17-length COCO-only frame, current or historical, without throwing.
  if (frame.length >= KP.rightToe + 1) {
    const feet: Array<{ id: BodyPartId; ankle: number; heel: number; toe: number }> = [
      { id: "left_foot", ankle: KP.leftAnkle, heel: KP.leftHeel, toe: KP.leftToe },
      { id: "right_foot", ankle: KP.rightAnkle, heel: KP.rightHeel, toe: KP.rightToe },
    ];
    for (const foot of feet) {
      const ankle = frame[foot.ankle];
      const heel = frame[foot.heel];
      const toe = frame[foot.toe];
      if (!valid(ankle) || !valid(heel) || !valid(toe)) continue;
      push(
        out,
        foot.id,
        footPolygon(ankle, heel, toe, scale),
        Math.min(ankle.c, heel.c, toe.c),
      );
    }
  }

  return out;
}

export type PartMotion = {
  id: BodyPartId;
  label: string;
  group: BodyPartGroup;
  /** Per-frame centroid speed, normalised by shoulder width (scale-invariant). */
  speed: number[];
  peakSpeed: number;
  peakFrame: number;
};

/**
 * Per-part centroid speed across a sequence — this is what answers
 * "which part is moving how" in the UI.
 *
 * Speeds are normalised by that frame's shoulder width, so they're
 * comparable across camera distances, and expressed per second using fps.
 */
export function computePartMotion(
  frames: PoseFrame[],
  fps: number,
): PartMotion[] {
  if (frames.length < 2 || fps <= 0) return [];

  const perFrame = frames.map((f) => segmentBodyParts(f));
  const byId = new Map<BodyPartId, { centroids: (Point | null)[] }>();

  for (const id of Object.keys(PART_META) as BodyPartId[]) {
    byId.set(id, { centroids: perFrame.map(() => null) });
  }
  perFrame.forEach((regions, i) => {
    for (const r of regions) {
      byId.get(r.id)!.centroids[i] = r.centroid;
    }
  });

  const scales = frames.map((f) => {
    const ls = f?.[KP.leftShoulder];
    const rs = f?.[KP.rightShoulder];
    if (valid(ls) && valid(rs)) {
      const s = Math.hypot(ls.x - rs.x, ls.y - rs.y);
      if (s > 1e-6) return s;
    }
    return 0;
  });

  const out: PartMotion[] = [];
  for (const [id, { centroids }] of byId) {
    const speed: number[] = new Array(frames.length).fill(0);
    let peakSpeed = 0;
    let peakFrame = 0;
    for (let i = 1; i < frames.length; i++) {
      const prev = centroids[i - 1];
      const cur = centroids[i];
      const scale = scales[i] || scales[i - 1];
      if (!prev || !cur || !scale) continue;
      const v = (Math.hypot(cur.x - prev.x, cur.y - prev.y) / scale) * fps;
      speed[i] = v;
      if (v > peakSpeed) {
        peakSpeed = v;
        peakFrame = i;
      }
    }
    if (peakSpeed > 0) {
      const meta = PART_META[id];
      out.push({ id, label: meta.label, group: meta.group, speed, peakSpeed, peakFrame });
    }
  }

  out.sort((a, b) => b.peakSpeed - a.peakSpeed);
  return out;
}
