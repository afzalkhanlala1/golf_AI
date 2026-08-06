/**
 * Overlaying a second swing directly on the video.
 *
 * The 3D player compares two swings as stick figures in their own viewport.
 * This is the other thing a golfer means by "ghost": a translucent second
 * body drawn on top of the actual footage, so the difference is visible
 * against the real background rather than in an abstract scene.
 *
 * ## Why the ghost has to be re-fitted, not just drawn
 *
 * Ghost keypoints are pixel coordinates from a *different clip* — different
 * camera distance, different framing, possibly a different resolution. Drawn
 * raw they land wherever that video happened to put the golfer, which is
 * usually off-frame and always meaningless.
 *
 * So the ghost is scaled by the ratio of shoulder widths and translated so
 * the hip midpoints coincide. Shoulder width is the scale reference because
 * it is the most stable span on the body through a swing — hips rotate away
 * from the camera and foreshorten badly, and any vertical span changes as
 * the golfer bends.
 *
 * ## What this deliberately does not do
 *
 * It does not rotate the ghost to match. A rotation would hide exactly the
 * difference the golfer is looking for: if their shoulders are turned less
 * than the reference at the top, that gap is the finding, and spinning the
 * ghost to agree would erase it. Position and size are camera artefacts and
 * are worth removing; orientation is the swing itself and is not.
 */

import { KP, type Keypoint, type PoseFrame } from "@/lib/metrics/geometry";

const MIN_CONF = 0.3;

/** Spans below this in pixels are noise, not a measurement. */
const MIN_SPAN_PX = 12;

export function isVisible2(k: Keypoint | undefined): k is Keypoint {
  return !!k && k.c >= MIN_CONF;
}

/**
 * Where to pin the ghost on this frame.
 *
 * Hips first — they are the body's centre and the most stable anchor. But
 * requiring both hips drops a large share of frames on a down-the-line
 * clip, where the far hip spends much of the swing behind the near one:
 * measured at 43% of frames on real footage, which flickers so badly the
 * overlay is unusable. Shoulders are the fallback, and a single visible
 * side is better than nothing — an anchor a few centimetres off is far
 * less damaging than a ghost that vanishes every third frame.
 */
export function anchorOf(frame: PoseFrame): Keypoint | null {
  const pairs: Array<[number, number]> = [
    [KP.leftHip, KP.rightHip],
    [KP.leftShoulder, KP.rightShoulder],
  ];
  for (const [a, b] of pairs) {
    const ka = frame[a];
    const kb = frame[b];
    if (isVisible2(ka) && isVisible2(kb)) {
      return { x: (ka.x + kb.x) / 2, y: (ka.y + kb.y) / 2, c: Math.min(ka.c, kb.c) };
    }
    if (isVisible2(ka)) return ka;
    if (isVisible2(kb)) return kb;
  }
  return null;
}

/**
 * Leg span — hip midpoint to ankle midpoint, in pixels.
 *
 * This is the scale reference, and shoulder width is emphatically not.
 * Shoulder width is a *horizontal* span, so in a down-the-line view it
 * collapses toward zero at address (the shoulders line up along the camera
 * axis) and opens up at the top of the backswing. It therefore measures how
 * far the golfer has turned, not how far away they are. Using it produced a
 * 0.198 scale between two ordinary clips of similar framing — a five-fold
 * error — and made the overlay worse than no normalisation at all.
 *
 * Hip-to-ankle is immune to that. Rotation about the vertical axis does not
 * change a vertical distance, the legs stay near-straight through the whole
 * swing, and neither arm position nor spine angle affects it.
 */
export function legSpan(frame: PoseFrame): number | null {
  const hip = midOf(frame, KP.leftHip, KP.rightHip);
  const ankle = midOf(frame, KP.leftAnkle, KP.rightAnkle);
  if (!hip || !ankle) return null;
  const d = Math.hypot(hip.x - ankle.x, hip.y - ankle.y);
  return d >= MIN_SPAN_PX ? d : null;
}

function midOf(frame: PoseFrame, a: number, b: number): Keypoint | null {
  const ka = frame[a];
  const kb = frame[b];
  if (isVisible2(ka) && isVisible2(kb)) {
    return { x: (ka.x + kb.x) / 2, y: (ka.y + kb.y) / 2, c: Math.min(ka.c, kb.c) };
  }
  if (isVisible2(ka)) return ka;
  if (isVisible2(kb)) return kb;
  return null;
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/**
 * One scale factor for the whole comparison, not one per frame.
 *
 * The ghost-to-target scale is a relationship between two *cameras*, and
 * both were on a tripod, so it barely changes across a clip. Recomputing it
 * per frame instead samples pose jitter and pumps the ghost visibly larger
 * and smaller as it plays. The median over every measurable frame is both
 * steadier and more accurate than any single frame's reading.
 */
export function stableScale(
  primary: PoseFrame[],
  ghost: PoseFrame[],
): number | null {
  const spans = (frames: PoseFrame[]) =>
    frames.map(legSpan).filter((v): v is number => v !== null);

  const p = median(spans(primary));
  const g = median(spans(ghost));
  if (p === null || g === null || g < MIN_SPAN_PX) return null;
  return p / g;
}

/**
 * Re-fit one ghost frame onto the target frame's body.
 *
 * `scale` should come from `stableScale` for a whole sequence. Passing it
 * per frame is supported but produces the pumping described above.
 */
export function alignGhostFrame(
  ghost: PoseFrame,
  target: PoseFrame,
  scale?: number,
): PoseFrame | null {
  const ghostOrigin = anchorOf(ghost);
  const targetOrigin = anchorOf(target);
  if (!ghostOrigin || !targetOrigin) return null;

  let k = scale;
  if (k === undefined) {
    const gs = legSpan(ghost);
    const ts = legSpan(target);
    if (gs === null || ts === null) return null;
    k = ts / gs;
  }
  if (!Number.isFinite(k) || k <= 0) return null;

  return ghost.map((p) => ({
    x: targetOrigin.x + (p.x - ghostOrigin.x) * k,
    y: targetOrigin.y + (p.y - ghostOrigin.y) * k,
    c: p.c,
  }));
}

export type TrailPoint = { f: number; x: number; y: number; c: number };

/**
 * The path the hands travel, from the wrist landmarks.
 *
 * This is the trail that works on an ordinary phone clip. The clubhead
 * tracer needs 60fps or better, because it is found by frame differencing
 * and at 30fps the clubhead moves further between exposures than the club
 * is long. Wrists are different: they come from the pose model on every
 * frame independently, at a speed the model handles, so there is no
 * inter-frame tracking to break down and no frame-rate floor to enforce.
 *
 * Coaches read hand path directly anyway — whether the hands drop into the
 * slot or shove out toward the ball is the visible signature of over the
 * top, which is the most common amateur fault in the fault list.
 */
export function handPath(frames: PoseFrame[], from: number, to: number): TrailPoint[] {
  const lo = Math.max(0, Math.min(from, frames.length - 1));
  const hi = Math.max(0, Math.min(to, frames.length - 1));
  if (hi < lo) return [];

  // Pick one wrist for the whole path rather than per frame. Switching
  // sides mid-swing would put a jump in the trail that looks like a
  // tracking failure but is just the hands crossing.
  let leftScore = 0;
  let rightScore = 0;
  for (let t = lo; t <= hi; t++) {
    leftScore += frames[t]?.[KP.leftWrist]?.c ?? 0;
    rightScore += frames[t]?.[KP.rightWrist]?.c ?? 0;
  }
  const wrist = leftScore >= rightScore ? KP.leftWrist : KP.rightWrist;

  const out: TrailPoint[] = [];
  for (let t = lo; t <= hi; t++) {
    const k = frames[t]?.[wrist];
    if (!isVisible2(k)) continue;
    out.push({ f: t, x: k.x, y: k.y, c: k.c });
  }
  return out;
}

/**
 * Smooth a trail so it reads as a swept arc rather than a jagged polyline.
 *
 * Pose output jitters a pixel or two per frame, which is invisible on a
 * skeleton — each frame is drawn alone — but accumulates into a visible
 * saw-tooth once consecutive frames are joined into a path. A 3-tap taper
 * removes it without moving the arc.
 */
export function smoothTrail(points: TrailPoint[]): TrailPoint[] {
  if (points.length < 3) return points;
  return points.map((p, i) => {
    if (i === 0 || i === points.length - 1) return p;
    const a = points[i - 1]!;
    const b = points[i + 1]!;
    // Only smooth across frames that are actually adjacent; bridging a gap
    // would pull the path toward wherever the trail resumed.
    if (b.f - a.f > 4) return p;
    return {
      ...p,
      x: 0.25 * a.x + 0.5 * p.x + 0.25 * b.x,
      y: 0.25 * a.y + 0.5 * p.y + 0.25 * b.y,
    };
  });
}
