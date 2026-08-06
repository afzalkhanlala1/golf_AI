import { describe, expect, it } from "vitest";
import {
  buildTimeWarp,
  normalize,
  prepareSequence,
  project,
  toRenderSpace,
  torsoLength,
  yawAlign,
  yawOf,
  type Point3,
  type Pose3,
} from "./skeleton3d";

/** Build a 21-point pose with the four torso landmarks placed explicitly. */
function pose(opts: {
  ls: [number, number, number];
  rs: [number, number, number];
  lh: [number, number, number];
  rh: [number, number, number];
}): Pose3 {
  const pts: Pose3 = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0, v: 0 }));
  const put = (i: number, [x, y, z]: [number, number, number]) => {
    pts[i] = { x, y, z, v: 0.9 };
  };
  put(5, opts.ls);
  put(6, opts.rs);
  put(11, opts.lh);
  put(12, opts.rh);
  return pts;
}

/** Square-on golfer: hips along x, shoulders 0.5 above. */
function squarePose(): Pose3 {
  return pose({
    ls: [-0.2, 0.5, 0],
    rs: [0.2, 0.5, 0],
    lh: [-0.15, 0, 0],
    rh: [0.15, 0, 0],
  });
}

describe("toRenderSpace", () => {
  it("flips y, because world y grows downward and screens want up", () => {
    const p = toRenderSpace([[1, 2, 3, 0.9]]);
    expect(p![0]).toMatchObject({ x: 1, y: -2, z: 3, v: 0.9 });
  });

  it("returns null for a frame the backend never filled in", () => {
    // A 2D-only pose backend leaves world at zeros. Drawing that would put
    // a skeleton collapsed on the origin, which looks like real output.
    expect(toRenderSpace([[0, 0, 0, 0], [0, 0, 0, 0]])).toBeNull();
    expect(toRenderSpace([])).toBeNull();
  });
});

describe("normalize", () => {
  it("puts hips at the origin and makes torso length 1", () => {
    const p = squarePose();
    const unit = torsoLength(p)!;
    expect(unit).toBeCloseTo(0.5, 6);

    const n = normalize(p, unit);
    const hipMidX = (n[11]!.x + n[12]!.x) / 2;
    const hipMidY = (n[11]!.y + n[12]!.y) / 2;
    expect(hipMidX).toBeCloseTo(0, 6);
    expect(hipMidY).toBeCloseTo(0, 6);
    expect(torsoLength(n)!).toBeCloseTo(1, 6);
  });

  it("makes two differently sized golfers overlay", () => {
    const small = squarePose();
    const big = pose({
      ls: [-0.4, 1.0, 0],
      rs: [0.4, 1.0, 0],
      lh: [-0.3, 0, 0],
      rh: [0.3, 0, 0],
    });
    const a = normalize(small, torsoLength(small)!);
    const b = normalize(big, torsoLength(big)!);
    expect(b[5]!.x).toBeCloseTo(a[5]!.x, 6);
    expect(b[5]!.y).toBeCloseTo(a[5]!.y, 6);
  });
});

describe("yaw alignment", () => {
  it("turns a rotated stance back onto the x axis", () => {
    const turned = pose({
      ls: [-0.14, 0.5, -0.14],
      rs: [0.14, 0.5, 0.14],
      lh: [-0.106, 0, -0.106],
      rh: [0.106, 0, 0.106],
    });
    const yaw = yawOf(turned)!;
    expect(yaw).toBeCloseTo(Math.PI / 4, 3);

    const aligned = yawAlign(turned, yaw);
    // Hip line now runs along x, so its z extent collapses.
    expect(aligned[12]!.z - aligned[11]!.z).toBeCloseTo(0, 6);
    expect(aligned[12]!.x).toBeGreaterThan(aligned[11]!.x);
  });

  it("preserves shoulder turn when the address yaw is applied to all frames", () => {
    // This is the whole reason yaw is measured once rather than per frame.
    // At the top of the backswing the shoulders are turned ~80 deg while
    // the hips have only turned a little. Re-deriving yaw per frame would
    // square the body up again and delete the turn being measured.
    const address = squarePose();
    const top = pose({
      ls: [-0.03, 0.5, -0.197],
      rs: [0.03, 0.5, 0.197],
      lh: [-0.13, 0, -0.075],
      rh: [0.13, 0, 0.075],
    });

    const yaw = yawOf(address)!;
    const alignedTop = yawAlign(normalize(top, torsoLength(top)!), yaw);

    const shoulderTurn = Math.abs(
      Math.atan2(
        alignedTop[6]!.z - alignedTop[5]!.z,
        alignedTop[6]!.x - alignedTop[5]!.x,
      ),
    );
    expect(shoulderTurn * (180 / Math.PI)).toBeGreaterThan(60);
  });
});

describe("buildTimeWarp", () => {
  const primary = [
    { event: "address", frame: 10 },
    { event: "top", frame: 40 },
    { event: "impact", frame: 60 },
    { event: "finish", frame: 90 },
  ];
  // Same swing, filmed slower and longer.
  const ghost = [
    { event: "address", frame: 20 },
    { event: "top", frame: 80 },
    { event: "impact", frame: 120 },
    { event: "finish", frame: 180 },
  ];

  it("lands matched events exactly on each other", () => {
    const warp = buildTimeWarp(primary, ghost, 100, 200);
    expect(warp(10)).toBe(20);
    expect(warp(40)).toBe(80);
    expect(warp(60)).toBe(120);
    expect(warp(90)).toBe(180);
  });

  it("interpolates between events", () => {
    const warp = buildTimeWarp(primary, ghost, 100, 200);
    // Halfway from top to impact in the primary is halfway in the ghost.
    expect(warp(50)).toBe(100);
  });

  it("never runs backwards and never leaves the ghost range", () => {
    const warp = buildTimeWarp(primary, ghost, 100, 200);
    let prev = -1;
    for (let f = 0; f < 100; f++) {
      const g = warp(f);
      expect(g).toBeGreaterThanOrEqual(0);
      expect(g).toBeLessThan(200);
      expect(g).toBeGreaterThanOrEqual(prev);
      prev = g;
    }
  });

  it("falls back to a length ratio when no events match", () => {
    const warp = buildTimeWarp(primary, [{ event: "nope", frame: 1 }], 100, 200);
    expect(warp(0)).toBe(0);
    expect(warp(99)).toBeLessThan(200);
    expect(warp(50)).toBeGreaterThan(80);
  });

  it("survives events that disagree about order", () => {
    // Event detection can emit an impact before a top on a bad clip; the
    // warp must still be usable rather than dividing by zero.
    const messy = [
      { event: "address", frame: 10 },
      { event: "top", frame: 60 },
      { event: "impact", frame: 40 },
    ];
    const warp = buildTimeWarp(messy, ghost, 100, 200);
    for (let f = 0; f < 100; f++) {
      expect(Number.isFinite(warp(f))).toBe(true);
    }
  });
});

describe("project", () => {
  const cam = { azimuth: 0, elevation: 0, distance: 4 };

  it("puts the origin at the centre of the canvas", () => {
    const p = project({ x: 0, y: 0, z: 0, v: 1 }, cam, 400, 300, 1);
    expect(p.x).toBeCloseTo(200, 6);
    expect(p.y).toBeCloseTo(150, 6);
  });

  // MediaPipe: smaller z is closer to the camera. Getting this backwards
  // would paint the far arm over the near one and read inside-out.
  it("reports greater depth for points further from the camera", () => {
    const near = project({ x: 0, y: 0, z: -1, v: 1 }, cam, 400, 300, 1);
    const far = project({ x: 0, y: 0, z: 1, v: 1 }, cam, 400, 300, 1);
    expect(far.depth).toBeGreaterThan(near.depth);
  });

  it("draws nearer points larger", () => {
    const near = project({ x: 1, y: 0, z: -1, v: 1 }, cam, 400, 300, 1);
    const far = project({ x: 1, y: 0, z: 1, v: 1 }, cam, 400, 300, 1);
    expect(Math.abs(near.x - 200)).toBeGreaterThan(Math.abs(far.x - 200));
  });

  it("stays finite for a point that lands on the camera", () => {
    const p = project({ x: 0, y: 0, z: -4, v: 1 }, cam, 400, 300, 1);
    expect(Number.isFinite(p.x)).toBe(true);
    expect(Number.isFinite(p.y)).toBe(true);
  });

  it("azimuth swings the view around the golfer", () => {
    const front = project({ x: 1, y: 0, z: 0, v: 1 }, cam, 400, 300, 1);
    const side = project(
      { x: 1, y: 0, z: 0, v: 1 },
      { ...cam, azimuth: Math.PI / 2 },
      400,
      300,
      1,
    );
    // Rotated a quarter turn, the point that was off to the side is now
    // pointing at the camera, so its horizontal offset collapses.
    expect(Math.abs(side.x - 200)).toBeLessThan(Math.abs(front.x - 200));
  });
});

describe("prepareSequence", () => {
  const frame = (p: Pose3): number[][] =>
    p.map((k: Point3) => [k.x, -k.y, k.z, k.v]);

  it("returns null when the backend supplied no 3D at all", () => {
    expect(prepareSequence(null, 0)).toBeNull();
    expect(prepareSequence([], 0)).toBeNull();
    const empty = Array.from({ length: 21 }, () => [0, 0, 0, 0]);
    expect(prepareSequence([empty, empty], 0)).toBeNull();
  });

  it("normalises every frame against the reference frame's scale", () => {
    const seq = prepareSequence([frame(squarePose()), frame(squarePose())], 0);
    expect(seq).not.toBeNull();
    expect(torsoLength(seq![0]!)!).toBeCloseTo(1, 6);
    expect(torsoLength(seq![1]!)!).toBeCloseTo(1, 6);
  });

  it("keeps null holes for frames with no pose rather than faking them", () => {
    const empty = Array.from({ length: 21 }, () => [0, 0, 0, 0]);
    const seq = prepareSequence([frame(squarePose()), empty], 0);
    expect(seq![0]).not.toBeNull();
    expect(seq![1]).toBeNull();
  });
});
