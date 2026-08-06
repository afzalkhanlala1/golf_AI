import { describe, expect, it } from "vitest";
import { KP, type PoseFrame } from "@/lib/metrics/geometry";
import {
  PART_META,
  computePartMotion,
  segmentBodyParts,
  type BodyPartId,
} from "./body-parts";

/**
 * Anatomically plausible upright pose, image coords (y grows downward).
 * 21 points by default (COCO-17 + real heel/toe), matching what the
 * MediaPipe backend actually produces in production. Tests that want to
 * exercise the RTMPose/COCO-only degradation path build their own
 * 17-length frame explicitly (see "omits feet on a COCO-only frame" below).
 */
function uprightPose(overrides: Partial<Record<number, { x: number; y: number; c: number }>> = {}): PoseFrame {
  const f: PoseFrame = Array.from({ length: 21 }, () => ({ x: 0, y: 0, c: 0 }));
  f[KP.nose] = { x: 100, y: 40, c: 0.9 };
  f[KP.leftShoulder] = { x: 80, y: 80, c: 0.9 };
  f[KP.rightShoulder] = { x: 120, y: 80, c: 0.9 };
  f[KP.leftElbow] = { x: 70, y: 120, c: 0.9 };
  f[KP.rightElbow] = { x: 130, y: 120, c: 0.9 };
  f[KP.leftWrist] = { x: 65, y: 160, c: 0.9 };
  f[KP.rightWrist] = { x: 135, y: 160, c: 0.9 };
  f[KP.leftHip] = { x: 88, y: 170, c: 0.9 };
  f[KP.rightHip] = { x: 112, y: 170, c: 0.9 };
  f[KP.leftKnee] = { x: 86, y: 240, c: 0.9 };
  f[KP.rightKnee] = { x: 114, y: 240, c: 0.9 };
  f[KP.leftAnkle] = { x: 85, y: 310, c: 0.9 };
  f[KP.rightAnkle] = { x: 115, y: 310, c: 0.9 };
  f[KP.leftHeel] = { x: 80, y: 318, c: 0.9 };
  f[KP.leftToe] = { x: 85, y: 330, c: 0.9 };
  f[KP.rightHeel] = { x: 120, y: 318, c: 0.9 };
  f[KP.rightToe] = { x: 115, y: 330, c: 0.9 };
  for (const [idx, kp] of Object.entries(overrides)) {
    f[Number(idx)] = kp!;
  }
  return f;
}

function ids(regions: { id: BodyPartId }[]): BodyPartId[] {
  return regions.map((r) => r.id);
}

describe("segmentBodyParts", () => {
  it("emits every body part for a complete, confident pose", () => {
    const regions = segmentBodyParts(uprightPose());
    const got = new Set(ids(regions));
    for (const id of Object.keys(PART_META) as BodyPartId[]) {
      expect(got.has(id), `missing region: ${id}`).toBe(true);
    }
  });

  it("omits a limb whose keypoints are below the confidence floor", () => {
    const frame = uprightPose({
      [KP.leftKnee]: { x: 86, y: 240, c: 0.02 },
    });
    const got = new Set(ids(segmentBodyParts(frame)));
    // Both bones that depend on the left knee drop out...
    expect(got.has("left_thigh")).toBe(false);
    expect(got.has("left_shin")).toBe(false);
    // ...while the opposite leg is unaffected.
    expect(got.has("right_thigh")).toBe(true);
    expect(got.has("right_shin")).toBe(true);
  });

  it("returns nothing when the pose carries no usable scale reference", () => {
    const empty: PoseFrame = Array.from({ length: 17 }, () => ({ x: 0, y: 0, c: 0 }));
    expect(segmentBodyParts(empty)).toEqual([]);
  });

  it("gives every region a closed polygon and a confidence in [0,1]", () => {
    for (const r of segmentBodyParts(uprightPose())) {
      expect(r.polygon.length).toBeGreaterThanOrEqual(4);
      for (const p of r.polygon) {
        expect(Number.isFinite(p.x)).toBe(true);
        expect(Number.isFinite(p.y)).toBe(true);
      }
      expect(r.confidence).toBeGreaterThanOrEqual(0);
      expect(r.confidence).toBeLessThanOrEqual(1);
    }
  });

  it("thickens a limb perpendicular to its own axis, not axis-aligned", () => {
    // Left forearm runs purely horizontally: elbow (60,100) → wrist (140,100).
    // Its quad must therefore be spread in y, not x.
    const frame = uprightPose({
      [KP.leftElbow]: { x: 60, y: 100, c: 0.9 },
      [KP.leftWrist]: { x: 140, y: 100, c: 0.9 },
    });
    const forearm = segmentBodyParts(frame).find((r) => r.id === "left_forearm")!;
    const xs = forearm.polygon.map((p) => p.x);
    const ys = forearm.polygon.map((p) => p.y);
    const spreadX = Math.max(...xs) - Math.min(...xs);
    const spreadY = Math.max(...ys) - Math.min(...ys);
    expect(spreadX).toBeGreaterThan(spreadY);
    // Centroid sits on the bone's midpoint.
    expect(forearm.centroid.x).toBeCloseTo(100, 4);
    expect(forearm.centroid.y).toBeCloseTo(100, 4);
  });

  it("rotates the limb quad when the bone rotates", () => {
    // Same forearm, now vertical: the spread should swap axes.
    const frame = uprightPose({
      [KP.leftElbow]: { x: 100, y: 60, c: 0.9 },
      [KP.leftWrist]: { x: 100, y: 140, c: 0.9 },
    });
    const forearm = segmentBodyParts(frame).find((r) => r.id === "left_forearm")!;
    const xs = forearm.polygon.map((p) => p.x);
    const ys = forearm.polygon.map((p) => p.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(
      Math.max(...xs) - Math.min(...xs),
    );
  });

  it("scales regions with the golfer's apparent size", () => {
    const near = segmentBodyParts(uprightPose());
    // Same pose, every coordinate doubled = golfer twice as close.
    const farFrame = uprightPose();
    const scaled: PoseFrame = farFrame.map((k) => ({ x: k.x * 2, y: k.y * 2, c: k.c }));
    const far = segmentBodyParts(scaled);

    const nearHead = near.find((r) => r.id === "head")!;
    const farHead = far.find((r) => r.id === "head")!;
    const width = (r: typeof nearHead) =>
      Math.max(...r.polygon.map((p) => p.x)) - Math.min(...r.polygon.map((p) => p.x));
    expect(width(farHead) / width(nearHead)).toBeCloseTo(2, 5);
  });

  describe("feet", () => {
    it("builds the foot polygon from the three real observed points, not a guess", () => {
      const foot = segmentBodyParts(uprightPose()).find((r) => r.id === "left_foot")!;
      expect(foot).toBeDefined();
      // Every vertex must lie at or very near one of ankle/heel/toe (widened
      // slightly perpendicular to heel->toe) — never an invented position.
      const ankle = { x: 85, y: 310 };
      const heel = { x: 80, y: 318 };
      const toe = { x: 85, y: 330 };
      const near = (p: { x: number; y: number }, q: { x: number; y: number }, tol = 10) =>
        Math.hypot(p.x - q.x, p.y - q.y) < tol;
      expect(foot.polygon.some((p) => near(p, ankle))).toBe(true);
      expect(foot.polygon.some((p) => near(p, heel))).toBe(true);
      expect(foot.polygon.some((p) => near(p, toe))).toBe(true);
    });

    it("omits a foot when heel/toe are below the confidence floor", () => {
      const frame = uprightPose({
        [KP.leftHeel]: { x: 80, y: 318, c: 0.01 },
        [KP.leftToe]: { x: 85, y: 330, c: 0.01 },
      });
      const got = new Set(ids(segmentBodyParts(frame)));
      expect(got.has("left_foot")).toBe(false);
      // Everything upstream of the ankle is unaffected by missing feet.
      expect(got.has("left_shin")).toBe(true);
      expect(got.has("right_foot")).toBe(true);
    });

    it("omits both feet on a COCO-17-only frame (e.g. the RTMPose backend) rather than guessing", () => {
      const cocoOnly: PoseFrame = Array.from({ length: 17 }, () => ({ x: 0, y: 0, c: 0 }));
      cocoOnly[KP.leftShoulder] = { x: 80, y: 80, c: 0.9 };
      cocoOnly[KP.rightShoulder] = { x: 120, y: 80, c: 0.9 };
      cocoOnly[KP.leftHip] = { x: 88, y: 170, c: 0.9 };
      cocoOnly[KP.rightHip] = { x: 112, y: 170, c: 0.9 };
      cocoOnly[KP.leftKnee] = { x: 86, y: 240, c: 0.9 };
      cocoOnly[KP.leftAnkle] = { x: 85, y: 310, c: 0.9 };

      const got = new Set(ids(segmentBodyParts(cocoOnly)));
      expect(got.has("left_foot")).toBe(false);
      expect(got.has("right_foot")).toBe(false);
      // The shin — a real region on this backend — still comes through.
      expect(got.has("left_shin")).toBe(true);
    });
  });
});

describe("computePartMotion", () => {
  it("ranks the part that actually moved above the parts that did not", () => {
    const still = uprightPose();
    // Swing the left forearm outward across 10 frames; everything else fixed.
    const frames: PoseFrame[] = [];
    for (let i = 0; i < 10; i++) {
      const f: PoseFrame = still.map((k) => ({ ...k }));
      f[KP.leftWrist] = { x: 65 + i * 12, y: 160, c: 0.9 };
      frames.push(f);
    }

    const motion = computePartMotion(frames, 240);
    expect(motion.length).toBeGreaterThan(0);
    // The forearm carries the wrist, so it must top the ranking.
    expect(motion[0]!.id).toBe("left_forearm");

    const head = motion.find((m) => m.id === "head");
    // A static head should register no motion at all.
    expect(head).toBeUndefined();
  });

  it("tracks foot motion — e.g. a heel lifting off the ground during the swing", () => {
    const still = uprightPose();
    const frames: PoseFrame[] = [];
    for (let i = 0; i < 10; i++) {
      const f: PoseFrame = still.map((k) => ({ ...k }));
      // Trail heel rising through the downswing — a real, coachable signal.
      f[KP.rightHeel] = { x: 120, y: 318 - i * 4, c: 0.9 };
      frames.push(f);
    }
    const motion = computePartMotion(frames, 240);
    const rightFoot = motion.find((m) => m.id === "right_foot");
    expect(rightFoot).toBeDefined();
    expect(rightFoot!.peakSpeed).toBeGreaterThan(0);
  });

  it("is scale-invariant — the same swing filmed closer scores the same speed", () => {
    const build = (mult: number): PoseFrame[] => {
      const base = uprightPose();
      return Array.from({ length: 8 }, (_, i) => {
        const f: PoseFrame = base.map((k) => ({ x: k.x * mult, y: k.y * mult, c: k.c }));
        f[KP.leftWrist] = { x: (65 + i * 12) * mult, y: 160 * mult, c: 0.9 };
        return f;
      });
    };
    const near = computePartMotion(build(1), 240).find((m) => m.id === "left_forearm")!;
    const far = computePartMotion(build(2.5), 240).find((m) => m.id === "left_forearm")!;
    expect(far.peakSpeed).toBeCloseTo(near.peakSpeed, 5);
  });

  it("returns nothing for a sequence too short to differentiate", () => {
    expect(computePartMotion([uprightPose()], 240)).toEqual([]);
    expect(computePartMotion([], 240)).toEqual([]);
  });
});
