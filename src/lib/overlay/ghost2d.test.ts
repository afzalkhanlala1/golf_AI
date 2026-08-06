import { describe, expect, it } from "vitest";
import { KP, type PoseFrame } from "@/lib/metrics/geometry";
import {
  alignGhostFrame,
  handPath,
  legSpan,
  smoothTrail,
  stableScale,
} from "./ghost2d";

function blank(): PoseFrame {
  return Array.from({ length: 21 }, () => ({ x: 0, y: 0, c: 0 }));
}

function put(f: PoseFrame, i: number, x: number, y: number, c = 0.9) {
  f[i] = { x, y, c };
}

/**
 * A body: shoulders `sw` apart, hips `h` below them, ankles a further
 * `legs` below. Scale is driven by the leg span, so tests must supply legs.
 */
function torso(cx: number, cy: number, sw: number, h: number, legs = 200): PoseFrame {
  const f = blank();
  put(f, KP.leftShoulder, cx - sw / 2, cy);
  put(f, KP.rightShoulder, cx + sw / 2, cy);
  put(f, KP.leftHip, cx - (sw * 0.7) / 2, cy + h);
  put(f, KP.rightHip, cx + (sw * 0.7) / 2, cy + h);
  put(f, KP.leftAnkle, cx - (sw * 0.6) / 2, cy + h + legs);
  put(f, KP.rightAnkle, cx + (sw * 0.6) / 2, cy + h + legs);
  return f;
}

describe("alignGhostFrame", () => {
  it("lands the ghost's hips exactly on the target's hips", () => {
    // Ghost filmed closer and off to one side.
    const ghost = torso(900, 100, 200, 300, 400);
    const target = torso(400, 200, 100, 150, 200);
    const aligned = alignGhostFrame(ghost, target)!;

    const gx = (aligned[KP.leftHip]!.x + aligned[KP.rightHip]!.x) / 2;
    const gy = (aligned[KP.leftHip]!.y + aligned[KP.rightHip]!.y) / 2;
    const tx = (target[KP.leftHip]!.x + target[KP.rightHip]!.x) / 2;
    const ty = (target[KP.leftHip]!.y + target[KP.rightHip]!.y) / 2;

    expect(gx).toBeCloseTo(tx, 6);
    expect(gy).toBeCloseTo(ty, 6);
  });

  it("rescales the ghost to the target's leg span", () => {
    const ghost = torso(900, 100, 200, 300, 400);
    const target = torso(400, 200, 100, 150, 200);
    const aligned = alignGhostFrame(ghost, target)!;
    expect(legSpan(aligned)).toBeCloseTo(legSpan(target)!, 4);
  });

  it("preserves the ghost's own shape rather than snapping it to the target", () => {
    // Ghost is bent further over: its torso is longer relative to its legs.
    // That ratio must survive alignment, or the overlay would show no
    // difference and be pointless.
    const ghost = torso(900, 100, 200, 600, 400); // torso 1.5x legs
    const target = torso(400, 200, 100, 150, 200); // torso 0.75x legs
    const aligned = alignGhostFrame(ghost, target)!;

    const torsoLen = Math.abs(aligned[KP.leftShoulder]!.y - aligned[KP.leftHip]!.y);
    expect(torsoLen / legSpan(aligned)!).toBeCloseTo(1.5, 4);
  });

  it("returns null rather than guessing when landmarks are missing", () => {
    const target = torso(400, 200, 100, 150);
    expect(alignGhostFrame(blank(), target)).toBeNull();
    expect(alignGhostFrame(torso(900, 100, 200, 300), blank())).toBeNull();
  });

  it("returns null when the ghost is too small to scale from", () => {
    // A near-zero leg span would blow the scale factor up to infinity.
    const tiny = torso(900, 100, 200, 300, 2);
    expect(alignGhostFrame(tiny, torso(400, 200, 100, 150))).toBeNull();
  });

  it("still places the ghost when the far hip is occluded", () => {
    // Measured on real down-the-line footage: requiring both hips dropped
    // 43% of frames, which flickers the overlay into uselessness.
    const target = torso(400, 200, 100, 150);
    target[KP.rightHip] = { x: 0, y: 0, c: 0 };
    const ghost = torso(900, 100, 200, 300);
    expect(alignGhostFrame(ghost, target, 0.5)).not.toBeNull();
  });

  it("falls back to shoulders when neither hip is visible", () => {
    const target = torso(400, 200, 100, 150);
    target[KP.leftHip] = { x: 0, y: 0, c: 0 };
    target[KP.rightHip] = { x: 0, y: 0, c: 0 };
    const aligned = alignGhostFrame(torso(900, 100, 200, 300), target, 0.5)!;
    expect(aligned).not.toBeNull();
    // Pinned at the shoulder midpoint, which is where the anchor moved to.
    const sx = (aligned[KP.leftShoulder]!.x + aligned[KP.rightShoulder]!.x) / 2;
    expect(sx).toBeCloseTo(400, 6);
  });
});

describe("stableScale", () => {
  it("returns the ratio of median leg spans", () => {
    const primary = [torso(400, 200, 100, 150, 200), torso(400, 200, 100, 150, 200)];
    const ghost = [torso(900, 100, 200, 300, 400), torso(900, 100, 200, 300, 400)];
    expect(stableScale(primary, ghost)).toBeCloseTo(0.5, 6);
  });

  it("ignores a jittery outlier frame", () => {
    // A single bad pose frame must not set the scale for the whole clip.
    const primary = [
      torso(400, 200, 100, 150, 200),
      torso(400, 200, 100, 150, 200),
      torso(400, 200, 100, 150, 2000),
    ];
    const ghost = [torso(900, 100, 100, 300, 200)];
    expect(stableScale(primary, ghost)).toBeCloseTo(1, 6);
  });

  it("is not thrown off by a down-the-line stance", () => {
    // Shoulder width collapses toward zero when the golfer is side-on to
    // the camera. Measured on real footage this produced a 0.198 scale
    // between two similarly framed clips — a five-fold error. Leg span does
    // not move, so the same two bodies must come out at 1.0.
    const faceOn = [torso(400, 200, 120, 150, 200)];
    const sideOn = [torso(400, 200, 6, 150, 200)];
    expect(stableScale(faceOn, sideOn)).toBeCloseTo(1, 6);
  });

  it("returns null when nothing is measurable", () => {
    expect(stableScale([blank()], [blank()])).toBeNull();
    expect(stableScale([], [])).toBeNull();
  });
});

describe("handPath", () => {
  it("follows the more confident wrist for the whole path", () => {
    const frames: PoseFrame[] = [];
    for (let t = 0; t < 10; t++) {
      const f = blank();
      put(f, KP.leftWrist, 100 + t, 200, 0.9);
      put(f, KP.rightWrist, 500 + t, 600, 0.2); // consistently weak
      frames.push(f);
    }
    const path = handPath(frames, 0, 9);
    expect(path).toHaveLength(10);
    expect(path[0]!.x).toBe(100);
    expect(path[9]!.x).toBe(109);
  });

  it("does not switch wrists mid-swing when the hands cross", () => {
    // Right wrist is stronger overall but weaker in a few middle frames.
    // Switching there would put a jump in the trail that reads as a bug.
    const frames: PoseFrame[] = [];
    for (let t = 0; t < 10; t++) {
      const f = blank();
      put(f, KP.leftWrist, 100, 200, 0.5);
      put(f, KP.rightWrist, 500, 600, t >= 4 && t <= 5 ? 0.4 : 0.95);
      frames.push(f);
    }
    const path = handPath(frames, 0, 9);
    expect(path.every((p) => p.x === 500)).toBe(true);
  });

  it("skips frames where the wrist was not seen, keeping the frame index", () => {
    const frames: PoseFrame[] = [];
    for (let t = 0; t < 6; t++) {
      const f = blank();
      if (t !== 3) put(f, KP.leftWrist, 100 + t, 200, 0.9);
      frames.push(f);
    }
    const path = handPath(frames, 0, 5);
    expect(path.map((p) => p.f)).toEqual([0, 1, 2, 4, 5]);
  });

  it("clamps a range that runs past the end", () => {
    const frames = [blank()];
    put(frames[0]!, KP.leftWrist, 10, 10, 0.9);
    expect(handPath(frames, -5, 99)).toHaveLength(1);
  });
});

describe("smoothTrail", () => {
  it("keeps the endpoints exactly where they were", () => {
    const pts = [0, 1, 2, 3, 4].map((f) => ({ f, x: f * 10, y: 0, c: 0.9 }));
    const s = smoothTrail(pts);
    expect(s[0]).toEqual(pts[0]);
    expect(s[4]).toEqual(pts[4]);
  });

  it("pulls a single-frame spike back toward the line", () => {
    const pts = [
      { f: 0, x: 0, y: 0, c: 0.9 },
      { f: 1, x: 10, y: 40, c: 0.9 }, // spike
      { f: 2, x: 20, y: 0, c: 0.9 },
    ];
    expect(smoothTrail(pts)[1]!.y).toBeCloseTo(20, 6);
  });

  it("does not smooth across a long gap", () => {
    // Bridging a dropout would drag the path toward wherever it resumed.
    const pts = [
      { f: 0, x: 0, y: 0, c: 0.9 },
      { f: 1, x: 10, y: 40, c: 0.9 },
      { f: 20, x: 20, y: 0, c: 0.9 },
    ];
    expect(smoothTrail(pts)[1]!.y).toBe(40);
  });
});
