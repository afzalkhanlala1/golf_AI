import { describe, expect, it } from "vitest";
import { KP, type PoseFrame } from "@/lib/metrics/geometry";
import {
  distanceCheck,
  framingCue,
  fullBodyCheck,
  isReadyToFilm,
  marginCheck,
  runFramingChecks,
  type FramingCheck,
} from "./framing";

const W = 720;
const H = 1280;

function blank(): PoseFrame {
  return Array.from({ length: 21 }, () => ({ x: 0, y: 0, c: 0 }));
}

/**
 * A golfer standing in frame, spanning `fill` of the height from `top`.
 *
 * Joints are placed as fractions of the body's own height, not as fixed
 * offsets — otherwise shrinking `fill` leaves the knees below the ankles
 * and the bounding box no longer matches the size being tested.
 */
function golfer(top = 0.15, fill = 0.7, cx = W / 2): PoseFrame {
  const f = blank();
  const y0 = top * H;
  const span = fill * H;
  const put = (i: number, dx: number, frac: number) => {
    f[i] = { x: cx + dx, y: y0 + frac * span, c: 0.9 };
  };
  put(KP.nose, 0, 0);
  put(KP.leftShoulder, -60, 0.17);
  put(KP.rightShoulder, 60, 0.17);
  put(KP.leftHip, -45, 0.55);
  put(KP.rightHip, 45, 0.55);
  put(KP.leftKnee, -45, 0.78);
  put(KP.rightKnee, 45, 0.78);
  put(KP.leftAnkle, -50, 1);
  put(KP.rightAnkle, 50, 1);
  return f;
}

describe("fullBodyCheck", () => {
  it("passes a golfer with head and both feet visible", () => {
    expect(fullBodyCheck(golfer()).status).toBe("good");
  });

  it("names the direction to tilt when feet are cut off", () => {
    // Feet are what actually get cut off, and several metrics need them.
    const f = golfer();
    f[KP.leftAnkle] = { x: 0, y: 0, c: 0 };
    f[KP.rightAnkle] = { x: 0, y: 0, c: 0 };
    const c = fullBodyCheck(f);
    expect(c.status).toBe("off");
    expect(c.cue).toMatch(/down/i);
  });

  it("names the other direction when the head is cut off", () => {
    const f = golfer();
    f[KP.nose] = { x: 0, y: 0, c: 0 };
    expect(fullBodyCheck(f).cue).toMatch(/up/i);
  });

  it("asks the golfer to step in when nobody is there", () => {
    expect(fullBodyCheck(blank()).status).toBe("unknown");
  });
});

describe("distanceCheck", () => {
  it("accepts a golfer filling a reasonable share of the frame", () => {
    expect(distanceCheck(golfer(0.15, 0.7), H).status).toBe("good");
  });

  it("says move closer when they are small in frame", () => {
    const c = distanceCheck(golfer(0.3, 0.3), H);
    expect(c.status).toBe("off");
    expect(c.cue).toMatch(/closer/i);
  });

  it("says move back when they fill the whole frame", () => {
    const c = distanceCheck(golfer(0.0, 0.99), H);
    expect(c.cue).toMatch(/back/i);
  });
});

describe("marginCheck", () => {
  it("requires headroom for the club at the top of the backswing", () => {
    // A frame that only just fits someone standing will clip the club.
    const tight = marginCheck(golfer(0.01, 0.7), W, H);
    expect(tight.status).toBe("off");
    expect(tight.cue).toMatch(/above your head/i);
  });

  it("flags a golfer pushed against the side of the frame", () => {
    const c = marginCheck(golfer(0.15, 0.7, 30), W, H);
    expect(c.status).toBe("close");
    expect(c.cue).toMatch(/centre/i);
  });

  it("passes a well-placed golfer", () => {
    expect(marginCheck(golfer(), W, H).status).toBe("good");
  });
});

describe("isReadyToFilm", () => {
  const mk = (status: FramingCheck["status"]): FramingCheck => ({
    id: "x",
    label: "x",
    status,
    cue: "c",
  });

  it("requires every check to pass, with no partial credit", () => {
    expect(isReadyToFilm([mk("good"), mk("good")])).toBe(true);
    // "close" still means something gets cut off or comes out soft.
    expect(isReadyToFilm([mk("good"), mk("close")])).toBe(false);
    expect(isReadyToFilm([mk("good"), mk("unknown")])).toBe(false);
    expect(isReadyToFilm([])).toBe(false);
  });
});

describe("framingCue", () => {
  it("surfaces a hard problem ahead of a marginal one", () => {
    const checks: FramingCheck[] = [
      { id: "a", label: "a", status: "close", cue: "nearly" },
      { id: "b", label: "b", status: "off", cue: "wrong" },
    ];
    expect(framingCue(checks)).toBe("wrong");
  });

  it("confirms when everything passes", () => {
    expect(framingCue(runFramingChecks(golfer(), W, H))).toMatch(/looks good/i);
  });

  it("asks an empty frame to step in", () => {
    expect(framingCue(runFramingChecks(blank(), W, H))).toMatch(/step into frame/i);
  });
});

describe("runFramingChecks", () => {
  it("passes a well-framed golfer on every check", () => {
    const checks = runFramingChecks(golfer(), W, H);
    expect(checks).toHaveLength(3);
    expect(isReadyToFilm(checks)).toBe(true);
  });
});
