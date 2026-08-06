/**
 * Real-time setup coaching from a webcam.
 *
 * ## What this deliberately does not do
 *
 * It does not analyse your swing. A laptop webcam runs at 30fps, and the
 * whole downswing takes about a quarter of a second — that is seven or
 * eight frames, with the club smeared across every one. Live swing metrics
 * from a webcam would be invented.
 *
 * Address position is the opposite case. You hold it still, so 30fps is
 * plenty and the pose model is at its most reliable. Setup is also where
 * amateur faults are cheapest to fix: posture, knee flex, stance width and
 * ball-position balance are the roots of a large share of the swing faults
 * the upload pipeline goes on to detect. Coaching the thing a webcam can
 * actually see beats faking the thing it cannot.
 *
 * Every check returns a status plus a cue phrased as an instruction, so the
 * overlay can be read at a glance from two metres away.
 */

import {
  KP,
  angleFromVertical,
  jointAngle,
  midHip,
  midShoulder,
  shoulderWidth,
  stanceWidth,
  type PoseFrame,
} from "@/lib/metrics/geometry";

export type CheckStatus = "good" | "close" | "off" | "unknown";

export type LiveCheck = {
  id: string;
  label: string;
  status: CheckStatus;
  /** Formatted for display, e.g. "32°". Null when not measurable. */
  reading: string | null;
  /** Imperative and short — this is read while standing over a ball. */
  cue: string;
};

export type CoachView = "face_on" | "down_the_line";

/** Joint confidence below which we say "unknown" rather than guess. */
const MIN_CONF = 0.5;

function visible(frame: PoseFrame, ...idx: number[]): boolean {
  return idx.every((i) => (frame[i]?.c ?? 0) >= MIN_CONF);
}

/**
 * Grade a value against a target band.
 *
 * The "close" tier exists so the overlay does not flicker between good and
 * off while someone settles into position — a hard boundary makes the
 * feedback feel twitchy and untrustworthy.
 */
function grade(
  value: number,
  min: number,
  max: number,
  tolerance: number,
): CheckStatus {
  if (value >= min && value <= max) return "good";
  if (value >= min - tolerance && value <= max + tolerance) return "close";
  return "off";
}

const UNKNOWN = (id: string, label: string, cue: string): LiveCheck => ({
  id,
  label,
  status: "unknown",
  reading: null,
  cue,
});

/** Forward bend from the hips. The posture every other setup check sits on. */
export function spineAngleCheck(frame: PoseFrame): LiveCheck {
  if (!visible(frame, KP.leftShoulder, KP.rightShoulder, KP.leftHip, KP.rightHip)) {
    return UNKNOWN("spine", "Spine angle", "Step back so your torso is in frame");
  }
  // Shoulder→hip, not hip→shoulder: angleFromVertical measures against
  // vertical *down*, so the vector has to point downward for an upright
  // golfer to read as zero rather than 180.
  const angle = Math.abs(angleFromVertical(midShoulder(frame), midHip(frame)));
  const status = grade(angle, 25, 40, 6);
  return {
    id: "spine",
    label: "Spine angle",
    status,
    reading: `${angle.toFixed(0)}°`,
    cue:
      status === "good"
        ? "Posture looks good"
        : angle < 25
          ? "Bend more from the hips — push your hips back"
          : "Too much bend — stand a little taller",
  };
}

/** Athletic knee flex: soft, not squatting, not locked. */
export function kneeFlexCheck(frame: PoseFrame): LiveCheck {
  const side = (frame[KP.leftKnee]?.c ?? 0) >= (frame[KP.rightKnee]?.c ?? 0)
    ? { hip: KP.leftHip, knee: KP.leftKnee, ankle: KP.leftAnkle }
    : { hip: KP.rightHip, knee: KP.rightKnee, ankle: KP.rightAnkle };

  if (!visible(frame, side.hip, side.knee, side.ankle)) {
    return UNKNOWN("knee", "Knee flex", "Make sure your legs are in frame");
  }
  const angle = jointAngle(frame[side.hip]!, frame[side.knee]!, frame[side.ankle]!);
  const status = grade(angle, 155, 172, 7);
  return {
    id: "knee",
    label: "Knee flex",
    status,
    reading: `${angle.toFixed(0)}°`,
    cue:
      status === "good"
        ? "Nice athletic flex"
        : angle > 172
          ? "Soften your knees slightly"
          : "Too much knee bend — you're squatting",
  };
}

/**
 * Stance width as a multiple of shoulder width.
 *
 * Expressed as a ratio rather than a distance because it is the only form
 * that means the same thing at any camera distance.
 */
export function stanceWidthCheck(frame: PoseFrame): LiveCheck {
  if (!visible(frame, KP.leftAnkle, KP.rightAnkle, KP.leftShoulder, KP.rightShoulder)) {
    return UNKNOWN("stance", "Stance width", "Get your feet in frame");
  }
  const sw = shoulderWidth(frame);
  if (sw < 1e-3) {
    return UNKNOWN("stance", "Stance width", "Turn to face the camera");
  }
  const ratio = stanceWidth(frame) / sw;
  const status = grade(ratio, 0.9, 1.35, 0.2);
  return {
    id: "stance",
    label: "Stance width",
    status,
    reading: `${ratio.toFixed(2)}× shoulders`,
    cue:
      status === "good"
        ? "Stance width is solid"
        : ratio < 0.9
          ? "Widen your stance a little"
          : "Narrow your stance slightly",
  };
}

/**
 * Head position over the stance — face-on only.
 *
 * From down-the-line the camera is looking along the target line, so
 * horizontal head offset carries no information about balance. Returning a
 * confident reading there would be measuring the wrong axis.
 */
export function headOverBallCheck(frame: PoseFrame, view: CoachView): LiveCheck {
  if (view !== "face_on") {
    return UNKNOWN(
      "head",
      "Head position",
      "Switch to face-on to check head position",
    );
  }
  if (!visible(frame, KP.nose, KP.leftAnkle, KP.rightAnkle)) {
    return UNKNOWN("head", "Head position", "Get your head and feet in frame");
  }
  const sw = stanceWidth(frame);
  if (sw < 1e-3) {
    return UNKNOWN("head", "Head position", "Turn to face the camera");
  }
  const ankleMidX = (frame[KP.leftAnkle]!.x + frame[KP.rightAnkle]!.x) / 2;
  // Signed fraction of stance width. Positive means toward the lead side.
  const offset = (frame[KP.nose]!.x - ankleMidX) / sw;
  const magnitude = Math.abs(offset);
  const status = grade(magnitude, 0, 0.18, 0.12);
  return {
    id: "head",
    label: "Head position",
    status,
    reading: `${(offset * 100).toFixed(0)}% of stance`,
    cue:
      status === "good"
        ? "Nicely centred"
        : "Centre your head between your feet",
  };
}

export function runLiveChecks(frame: PoseFrame, view: CoachView): LiveCheck[] {
  return [
    spineAngleCheck(frame),
    kneeFlexCheck(frame),
    stanceWidthCheck(frame),
    headOverBallCheck(frame, view),
  ];
}

/**
 * The one thing to say out loud.
 *
 * Four simultaneous corrections is noise to someone standing over a ball,
 * and posture is the one that changes the others — fix the spine angle and
 * knee flex often follows. So the checks are ranked, and only the worst one
 * that is actually wrong gets surfaced as the headline cue.
 */
const PRIORITY = ["spine", "knee", "stance", "head"];

export function primaryCue(checks: LiveCheck[]): string {
  const byId = new Map(checks.map((c) => [c.id, c]));
  for (const status of ["off", "close"] as const) {
    for (const id of PRIORITY) {
      const c = byId.get(id);
      if (c && c.status === status) return c.cue;
    }
  }
  const known = checks.filter((c) => c.status !== "unknown");
  if (known.length === 0) return "Step into frame to start";
  return "Setup looks good — make your swing";
}
