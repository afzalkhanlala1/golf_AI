import { describe, expect, it } from "vitest";
import { KP, type PoseFrame } from "@/lib/metrics/geometry";
import {
  kneeFlexCheck,
  headOverBallCheck,
  primaryCue,
  runLiveChecks,
  spineAngleCheck,
  stanceWidthCheck,
  type LiveCheck,
} from "./live-checks";

/** Blank 21-point frame; everything invisible until placed. */
function blank(): PoseFrame {
  return Array.from({ length: 21 }, () => ({ x: 0, y: 0, c: 0 }));
}

function put(f: PoseFrame, i: number, x: number, y: number, c = 0.9) {
  f[i] = { x, y, c };
}

/**
 * A golfer at address, face-on. Image coordinates, y down.
 * Spine leans forward ~30 degrees; knees softly flexed; stance ~1.1x shoulders.
 */
function addressPose(): PoseFrame {
  const f = blank();
  put(f, KP.nose, 300, 100);
  put(f, KP.leftShoulder, 260, 170);
  put(f, KP.rightShoulder, 340, 170);
  put(f, KP.leftHip, 275, 300);
  put(f, KP.rightHip, 325, 300);
  put(f, KP.leftKnee, 270, 390);
  put(f, KP.rightKnee, 330, 390);
  put(f, KP.leftAnkle, 256, 480);
  put(f, KP.rightAnkle, 344, 480);
  return f;
}

describe("spineAngleCheck", () => {
  it("says unknown rather than guessing when the torso is not visible", () => {
    const c = spineAngleCheck(blank());
    expect(c.status).toBe("unknown");
    expect(c.reading).toBeNull();
  });

  it("passes a forward bend inside the band", () => {
    const f = addressPose();
    // Shoulders well forward of the hips -> real spine tilt.
    put(f, KP.leftShoulder, 200, 180);
    put(f, KP.rightShoulder, 280, 180);
    const c = spineAngleCheck(f);
    expect(["good", "close"]).toContain(c.status);
  });

  it("tells a golfer standing too upright to bend more", () => {
    const f = addressPose();
    // Shoulders directly above hips: no forward bend at all.
    put(f, KP.leftShoulder, 275, 170);
    put(f, KP.rightShoulder, 325, 170);
    const c = spineAngleCheck(f);
    expect(c.status).toBe("off");
    expect(c.cue).toMatch(/bend more/i);
  });
});

describe("kneeFlexCheck", () => {
  it("flags locked legs", () => {
    const f = addressPose();
    put(f, KP.leftHip, 270, 300);
    put(f, KP.leftKnee, 270, 390);
    put(f, KP.leftAnkle, 270, 480); // perfectly straight = 180 deg
    put(f, KP.rightKnee, 0, 0, 0); // force the left side to be chosen
    const c = kneeFlexCheck(f);
    expect(c.status).toBe("off");
    expect(c.cue).toMatch(/soften/i);
  });

  it("accepts a soft athletic flex", () => {
    const f = addressPose();
    put(f, KP.leftHip, 270, 300);
    put(f, KP.leftKnee, 285, 390);
    put(f, KP.leftAnkle, 270, 480);
    put(f, KP.rightKnee, 0, 0, 0);
    const c = kneeFlexCheck(f);
    expect(["good", "close"]).toContain(c.status);
  });
});

describe("stanceWidthCheck", () => {
  it("reports width as a multiple of shoulders, not pixels", () => {
    const c = stanceWidthCheck(addressPose());
    expect(c.reading).toMatch(/× shoulders/);
  });

  it("is unchanged when the golfer stands further from the camera", () => {
    const near = addressPose();
    const far = blank();
    // Same pose at half scale about the origin.
    near.forEach((k, i) => {
      if (k.c > 0) put(far, i, k.x / 2, k.y / 2, k.c);
    });
    expect(stanceWidthCheck(far).reading).toBe(stanceWidthCheck(near).reading);
  });

  it("tells a narrow stance to widen", () => {
    const f = addressPose();
    put(f, KP.leftAnkle, 292, 480);
    put(f, KP.rightAnkle, 308, 480);
    const c = stanceWidthCheck(f);
    expect(c.status).toBe("off");
    expect(c.cue).toMatch(/widen/i);
  });
});

describe("headOverBallCheck", () => {
  it("refuses to measure from down-the-line", () => {
    // Horizontal head offset along the camera axis carries no information.
    const c = headOverBallCheck(addressPose(), "down_the_line");
    expect(c.status).toBe("unknown");
    expect(c.cue).toMatch(/face-on/i);
  });

  it("passes a centred head face-on", () => {
    const c = headOverBallCheck(addressPose(), "face_on");
    expect(c.status).toBe("good");
  });

  it("flags a head well outside the stance", () => {
    const f = addressPose();
    put(f, KP.nose, 420, 100);
    const c = headOverBallCheck(f, "face_on");
    expect(c.status).toBe("off");
  });
});

describe("primaryCue", () => {
  const mk = (id: string, status: LiveCheck["status"]): LiveCheck => ({
    id,
    label: id,
    status,
    reading: null,
    cue: `fix ${id}`,
  });

  it("surfaces posture before the smaller stuff", () => {
    // Both wrong: posture is the one that moves the others, so it leads.
    const cue = primaryCue([mk("spine", "off"), mk("stance", "off")]);
    expect(cue).toBe("fix spine");
  });

  it("prefers a clearly wrong check over a marginal one", () => {
    const cue = primaryCue([mk("spine", "close"), mk("stance", "off")]);
    expect(cue).toBe("fix stance");
  });

  it("confirms when everything passes", () => {
    expect(primaryCue([mk("spine", "good"), mk("knee", "good")])).toMatch(
      /looks good/i,
    );
  });

  it("asks the golfer to step in when nothing is measurable", () => {
    expect(primaryCue([mk("spine", "unknown")])).toMatch(/step into frame/i);
  });
});

describe("runLiveChecks", () => {
  it("always returns one entry per check, even with no pose", () => {
    const checks = runLiveChecks(blank(), "face_on");
    expect(checks).toHaveLength(4);
    expect(checks.every((c) => c.status === "unknown")).toBe(true);
  });
});
