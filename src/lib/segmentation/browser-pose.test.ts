import { describe, expect, it } from "vitest";
import { KP } from "@/lib/metrics/geometry";
import { emptyFrame, mediapipeToKeypoints, type Landmark } from "./browser-pose";
import { segmentBodyParts } from "./body-parts";

/**
 * MediaPipe Pose emits 33 landmarks in a fixed order. Encoding the indices we
 * actually depend on here means a wrong mapping fails loudly instead of
 * silently producing a mangled skeleton.
 */
const MP = {
  nose: 0,
  leftEye: 2,
  rightEye: 5,
  leftEar: 7,
  rightEar: 8,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
  leftHeel: 29,
  rightHeel: 30,
  leftFootIndex: 31,
  rightFootIndex: 32,
} as const;

/** 33 landmarks where each one's x encodes its own index, so we can assert
 *  precisely which MediaPipe landmark ended up in which output slot. */
function tagged(): Landmark[] {
  return Array.from({ length: 33 }, (_, i) => ({
    x: i / 100,
    y: i / 100,
    z: 0,
    visibility: 0.8,
  }));
}

describe("mediapipeToKeypoints", () => {
  it("routes each MediaPipe landmark to the correct output slot, including feet", () => {
    const frame = mediapipeToKeypoints(tagged(), 100, 100);
    const pairs: Array<[number, number]> = [
      [KP.nose, MP.nose],
      [KP.leftShoulder, MP.leftShoulder],
      [KP.rightShoulder, MP.rightShoulder],
      [KP.leftElbow, MP.leftElbow],
      [KP.rightElbow, MP.rightElbow],
      [KP.leftWrist, MP.leftWrist],
      [KP.rightWrist, MP.rightWrist],
      [KP.leftHip, MP.leftHip],
      [KP.rightHip, MP.rightHip],
      [KP.leftKnee, MP.leftKnee],
      [KP.rightKnee, MP.rightKnee],
      [KP.leftAnkle, MP.leftAnkle],
      [KP.rightAnkle, MP.rightAnkle],
      [KP.leftHeel, MP.leftHeel],
      [KP.leftToe, MP.leftFootIndex],
      [KP.rightHeel, MP.rightHeel],
      [KP.rightToe, MP.rightFootIndex],
    ];
    for (const [outIdx, mpIdx] of pairs) {
      // x was set to index/100 then scaled by width 100 → equals the index.
      expect(frame[outIdx]!.x, `output ${outIdx} should come from MP ${mpIdx}`).toBeCloseTo(
        mpIdx,
        6,
      );
    }
  });

  it("produces exactly 21 keypoints (COCO-17 + 4 foot points)", () => {
    expect(mediapipeToKeypoints(tagged(), 640, 480)).toHaveLength(21);
  });

  it("scales normalised coordinates into pixel space", () => {
    const lms = tagged();
    lms[MP.leftShoulder] = { x: 0.25, y: 0.5, z: 0, visibility: 0.9 };
    const frame = mediapipeToKeypoints(lms, 800, 600);
    expect(frame[KP.leftShoulder]!.x).toBeCloseTo(200, 6);
    expect(frame[KP.leftShoulder]!.y).toBeCloseTo(300, 6);
  });

  it("carries visibility through as confidence, for a foot point too", () => {
    const lms = tagged();
    lms[MP.leftKnee] = { x: 0.5, y: 0.5, z: 0, visibility: 0.21 };
    lms[MP.leftHeel] = { x: 0.5, y: 0.9, z: 0, visibility: 0.33 };
    const frame = mediapipeToKeypoints(lms, 100, 100);
    expect(frame[KP.leftKnee]!.c).toBeCloseTo(0.21, 6);
    expect(frame[KP.leftHeel]!.c).toBeCloseTo(0.33, 6);
  });

  it("returns a blank 21-point frame when no person was detected", () => {
    expect(mediapipeToKeypoints(undefined, 100, 100)).toEqual(emptyFrame());
    expect(mediapipeToKeypoints([], 100, 100)).toEqual(emptyFrame());
    expect(emptyFrame()).toHaveLength(21);
  });

  it("feeds segmentBodyParts a frame it can fully segment, feet included", () => {
    // Anatomically ordered landmarks (normalised), upright figure.
    const lms = Array.from({ length: 33 }, () => ({
      x: 0.5,
      y: 0.5,
      z: 0,
      visibility: 0.9,
    })) as Landmark[];
    lms[MP.nose] = { x: 0.5, y: 0.1, z: 0, visibility: 0.9 };
    lms[MP.leftShoulder] = { x: 0.42, y: 0.25, z: 0, visibility: 0.9 };
    lms[MP.rightShoulder] = { x: 0.58, y: 0.25, z: 0, visibility: 0.9 };
    lms[MP.leftElbow] = { x: 0.38, y: 0.4, z: 0, visibility: 0.9 };
    lms[MP.rightElbow] = { x: 0.62, y: 0.4, z: 0, visibility: 0.9 };
    lms[MP.leftWrist] = { x: 0.36, y: 0.54, z: 0, visibility: 0.9 };
    lms[MP.rightWrist] = { x: 0.64, y: 0.54, z: 0, visibility: 0.9 };
    lms[MP.leftHip] = { x: 0.45, y: 0.56, z: 0, visibility: 0.9 };
    lms[MP.rightHip] = { x: 0.55, y: 0.56, z: 0, visibility: 0.9 };
    lms[MP.leftKnee] = { x: 0.44, y: 0.75, z: 0, visibility: 0.9 };
    lms[MP.rightKnee] = { x: 0.56, y: 0.75, z: 0, visibility: 0.9 };
    lms[MP.leftAnkle] = { x: 0.44, y: 0.94, z: 0, visibility: 0.9 };
    lms[MP.rightAnkle] = { x: 0.56, y: 0.94, z: 0, visibility: 0.9 };
    lms[MP.leftHeel] = { x: 0.42, y: 0.97, z: 0, visibility: 0.9 };
    lms[MP.leftFootIndex] = { x: 0.44, y: 1.0, z: 0, visibility: 0.9 };
    lms[MP.rightHeel] = { x: 0.58, y: 0.97, z: 0, visibility: 0.9 };
    lms[MP.rightFootIndex] = { x: 0.56, y: 1.0, z: 0, visibility: 0.9 };

    const frame = mediapipeToKeypoints(lms, 480, 640);
    const regions = segmentBodyParts(frame);
    // All 13 regions (11 + 2 feet) should materialise from a clean detection.
    expect(regions).toHaveLength(13);
    const head = regions.find((r) => r.id === "head")!;
    const foot = regions.find((r) => r.id === "left_foot")!;
    // Head must sit above the feet in image coords (y grows downward).
    expect(head.centroid.y).toBeLessThan(foot.centroid.y);
  });
});
