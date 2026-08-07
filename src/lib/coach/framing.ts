/**
 * Checking the shot before the golfer films it.
 *
 * ## Why this exists as a separate step
 *
 * Almost every rejected or low-confidence analysis traces back to framing:
 * feet cut off, golfer too far away to resolve, body clipped at the edge
 * when the club swings through. All of those are free to fix *before*
 * filming and impossible to fix afterwards — the golfer has to go back out
 * and hit another one.
 *
 * So this runs against the live camera and answers one question: if you
 * filmed a swing from exactly here, would it analyse well? It never
 * records. The golfer positions the phone, gets a green light, then films
 * with their own camera app in slow motion — which is the only way to get
 * the frame rate the speed features need.
 *
 * ## Why the margins are generous
 *
 * The pose seen here is a golfer standing still. During the swing the arms
 * go overhead and the club extends well past the body, so a frame that only
 * just contains someone at address will clip them at the top of the
 * backswing. The headroom requirement is deliberately larger than the
 * standing pose needs.
 */

import { KP, type PoseFrame } from "@/lib/metrics/geometry";

export type FramingStatus = "good" | "close" | "off" | "unknown";

export type FramingCheck = {
  id: string;
  label: string;
  status: FramingStatus;
  cue: string;
};

const MIN_CONF = 0.5;

/** Fraction of frame height the golfer should occupy. */
const MIN_FILL = 0.55;
const MAX_FILL = 0.9;

/** Space to leave above the head for the club at the top of the backswing. */
const MIN_HEADROOM = 0.06;

function visible(frame: PoseFrame, ...idx: number[]): boolean {
  return idx.every((i) => (frame[i]?.c ?? 0) >= MIN_CONF);
}

function bodyBox(frame: PoseFrame) {
  const pts = frame.filter((k) => k.c >= MIN_CONF);
  if (pts.length < 4) return null;
  return {
    x1: Math.min(...pts.map((p) => p.x)),
    y1: Math.min(...pts.map((p) => p.y)),
    x2: Math.max(...pts.map((p) => p.x)),
    y2: Math.max(...pts.map((p) => p.y)),
  };
}

/**
 * Is the whole golfer in shot?
 *
 * Head and both ankles specifically, rather than "most joints visible".
 * The feet are what get cut off in practice, and they are also what the
 * weight and stance measurements depend on — a clip missing them still
 * analyses, just with several metrics silently unavailable.
 */
export function fullBodyCheck(frame: PoseFrame): FramingCheck {
  const head = visible(frame, KP.nose);
  const feet = visible(frame, KP.leftAnkle, KP.rightAnkle);

  if (!head && !feet) {
    return {
      id: "full_body",
      label: "Full body",
      status: "unknown",
      cue: "Step into frame",
    };
  }
  if (!feet) {
    return {
      id: "full_body",
      label: "Full body",
      status: "off",
      cue: "Tilt the camera down — your feet are cut off",
    };
  }
  if (!head) {
    return {
      id: "full_body",
      label: "Full body",
      status: "off",
      cue: "Tilt the camera up — your head is cut off",
    };
  }
  return { id: "full_body", label: "Full body", status: "good", cue: "Whole body in shot" };
}

/** Too far away and the pose model has too few pixels to work with. */
export function distanceCheck(frame: PoseFrame, frameHeight: number): FramingCheck {
  const box = bodyBox(frame);
  if (!box || frameHeight <= 0) {
    return { id: "distance", label: "Distance", status: "unknown", cue: "Step into frame" };
  }
  const fill = (box.y2 - box.y1) / frameHeight;

  if (fill >= MIN_FILL && fill <= MAX_FILL) {
    return { id: "distance", label: "Distance", status: "good", cue: "Good distance" };
  }
  const close = fill >= MIN_FILL - 0.1 && fill <= MAX_FILL + 0.05;
  return {
    id: "distance",
    label: "Distance",
    status: close ? "close" : "off",
    cue: fill < MIN_FILL ? "Move the camera closer" : "Move the camera back",
  };
}

/**
 * Room around the golfer, especially above.
 *
 * Checked against the standing pose but sized for the swing — see the
 * module note on why headroom is the tight one.
 */
export function marginCheck(
  frame: PoseFrame,
  frameWidth: number,
  frameHeight: number,
): FramingCheck {
  const box = bodyBox(frame);
  if (!box || frameWidth <= 0 || frameHeight <= 0) {
    return { id: "margins", label: "Room to swing", status: "unknown", cue: "Step into frame" };
  }

  const top = box.y1 / frameHeight;
  const left = box.x1 / frameWidth;
  const right = (frameWidth - box.x2) / frameWidth;

  if (top < MIN_HEADROOM) {
    return {
      id: "margins",
      label: "Room to swing",
      status: "off",
      cue: "Leave space above your head for the club",
    };
  }
  if (left < 0.03 || right < 0.03) {
    return {
      id: "margins",
      label: "Room to swing",
      status: "close",
      cue: "Centre yourself in the frame",
    };
  }
  return { id: "margins", label: "Room to swing", status: "good", cue: "Plenty of room" };
}

export function runFramingChecks(
  frame: PoseFrame,
  width: number,
  height: number,
): FramingCheck[] {
  return [fullBodyCheck(frame), distanceCheck(frame, height), marginCheck(frame, width, height)];
}

/**
 * Ready to film only when every check passes.
 *
 * No partial credit: "close" still means something will be cut off or
 * blurry, and the whole point is to catch it now rather than after the
 * swing has been hit.
 */
export function isReadyToFilm(checks: FramingCheck[]): boolean {
  return checks.length > 0 && checks.every((c) => c.status === "good");
}

export function framingCue(checks: FramingCheck[]): string {
  const bad = checks.find((c) => c.status === "off") ?? checks.find((c) => c.status === "close");
  if (bad) return bad.cue;
  if (checks.some((c) => c.status === "unknown")) return "Step into frame";
  return "Framing looks good — film your swing";
}
