import { describe, expect, it } from "vitest";
import { KP, type PoseFrame } from "@/lib/metrics/geometry";
import {
  BONES,
  JOINTS,
  eventAtFrame,
  eventLabel,
  headOval,
  isVisible,
  trackingBox,
} from "./skeleton";

function pose(over: Record<number, { x: number; y: number; c: number }> = {}): PoseFrame {
  const f: PoseFrame = Array.from({ length: 17 }, () => ({ x: 0, y: 0, c: 0 }));
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
  for (const [k, v] of Object.entries(over)) f[Number(k)] = v;
  return f;
}

describe("skeleton definition", () => {
  it("draws no bones or dots on the face — the head oval covers it", () => {
    // COCO-17 face indices: 0 nose, 1/2 eyes, 3/4 ears. Only `nose` has a
    // name in KP, so the rest are referenced numerically.
    const facePoints = [KP.nose, 1, 2, 3, 4] as number[];
    for (const b of BONES) {
      expect(facePoints).not.toContain(b.a);
      expect(facePoints).not.toContain(b.b);
    }
    for (const j of JOINTS) expect(facePoints).not.toContain(j);
  });

  it("connects only real anatomical neighbours", () => {
    // A bone must never span two unconnected joints (e.g. wrist to ankle).
    const allowed = new Set(
      BONES.map((b) => `${Math.min(b.a, b.b)}-${Math.max(b.a, b.b)}`),
    );
    expect(allowed.has(`${KP.leftShoulder}-${KP.leftElbow}`)).toBe(true);
    expect(allowed.has(`${Math.min(KP.leftWrist, KP.leftAnkle)}-${Math.max(KP.leftWrist, KP.leftAnkle)}`)).toBe(false);
  });

  it("assigns every bone to a body region", () => {
    for (const b of BONES) {
      expect(["torso", "arms", "legs", "head"]).toContain(b.group);
    }
  });

  it("draws ankle-heel-toe as real foot bones", () => {
    const has = (a: number, b: number) =>
      BONES.some((bone) => (bone.a === a && bone.b === b) || (bone.a === b && bone.b === a));
    expect(has(KP.leftAnkle, KP.leftHeel)).toBe(true);
    expect(has(KP.leftHeel, KP.leftToe)).toBe(true);
    expect(has(KP.rightAnkle, KP.rightHeel)).toBe(true);
    expect(has(KP.rightHeel, KP.rightToe)).toBe(true);
    expect(JOINTS).toContain(KP.leftHeel);
    expect(JOINTS).toContain(KP.leftToe);
  });
});

describe("isVisible", () => {
  it("rejects low-confidence and non-finite points", () => {
    expect(isVisible(pose(), KP.leftWrist)).toBe(true);
    expect(isVisible(pose({ [KP.leftWrist]: { x: 65, y: 160, c: 0.05 } }), KP.leftWrist)).toBe(false);
    expect(isVisible(pose({ [KP.leftWrist]: { x: NaN, y: 160, c: 0.9 } }), KP.leftWrist)).toBe(false);
  });
});

describe("trackingBox", () => {
  it("encloses every visible keypoint", () => {
    const f = pose();
    const box = trackingBox(f, 400, 400)!;
    for (let i = 0; i < f.length; i++) {
      if (!isVisible(f, i)) continue;
      expect(f[i]!.x).toBeGreaterThanOrEqual(box.x1);
      expect(f[i]!.x).toBeLessThanOrEqual(box.x2);
      expect(f[i]!.y).toBeGreaterThanOrEqual(box.y1);
      expect(f[i]!.y).toBeLessThanOrEqual(box.y2);
    }
  });

  it("never extends past the frame", () => {
    // Golfer hard against the edges — padding must clamp, not overflow.
    const f = pose({
      [KP.leftShoulder]: { x: 0, y: 0, c: 0.9 },
      [KP.rightAnkle]: { x: 400, y: 400, c: 0.9 },
    });
    const box = trackingBox(f, 400, 400)!;
    expect(box.x1).toBeGreaterThanOrEqual(0);
    expect(box.y1).toBeGreaterThanOrEqual(0);
    expect(box.x2).toBeLessThanOrEqual(400);
    expect(box.y2).toBeLessThanOrEqual(400);
  });

  it("returns null rather than a collapsed box when tracking is lost", () => {
    const empty: PoseFrame = Array.from({ length: 17 }, () => ({ x: 0, y: 0, c: 0 }));
    expect(trackingBox(empty, 400, 400)).toBeNull();
  });
});

describe("headOval", () => {
  it("scales with shoulder width", () => {
    const near = headOval(pose())!;
    const wide = headOval(
      pose({
        [KP.leftShoulder]: { x: 60, y: 80, c: 0.9 },
        [KP.rightShoulder]: { x: 140, y: 80, c: 0.9 },
      }),
    )!;
    // Shoulders twice as wide -> head oval twice as large.
    expect(wide.rx / near.rx).toBeCloseTo(2, 5);
  });

  it("sits above the shoulders, not on the chin", () => {
    const o = headOval(pose())!;
    // y grows downward; the nose is at 40 and shoulders at 80, so the
    // centre must be lifted further up (smaller y) than the nose.
    expect(o.cy).toBeLessThan(pose()[KP.nose]!.y);
  });

  it("returns null without a nose", () => {
    expect(headOval(pose({ [KP.nose]: { x: 100, y: 40, c: 0 } }))).toBeNull();
  });
});

describe("event labelling", () => {
  it("formats an event name for display", () => {
    expect(eventLabel("mid_backswing")).toBe("MID-BACKSWING");
    expect(eventLabel("top")).toBe("TOP");
  });

  it("holds a label for a few frames so it is readable in motion", () => {
    const events = [
      { event: "top", frame: 100 },
      { event: "impact", frame: 120 },
    ];
    expect(eventAtFrame(events, 100)).toBe("top");
    expect(eventAtFrame(events, 102)).toBe("top");
    expect(eventAtFrame(events, 104)).toBeNull();
  });

  it("picks the nearest event when two are close together", () => {
    const events = [
      { event: "mid_downswing", frame: 100 },
      { event: "impact", frame: 103 },
    ];
    expect(eventAtFrame(events, 103)).toBe("impact");
    expect(eventAtFrame(events, 100)).toBe("mid_downswing");
  });
});
