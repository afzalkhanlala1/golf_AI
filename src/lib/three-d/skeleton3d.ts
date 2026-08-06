/**
 * 3D skeleton playback and ghost comparison.
 *
 * Everything here is pure so it can be tested without a canvas. The drawing
 * lives in the component; every decision with a right answer lives here.
 *
 * ## Coordinate systems
 *
 * The pipeline stores `world` landmarks straight from MediaPipe: metres,
 * origin at the hip midpoint, x right, **y down**, z roughly toward the
 * camera. Screen convention wants y up, so `toRenderSpace` flips it once,
 * at the boundary, rather than scattering minus signs through the maths.
 *
 * ## Why a ghost needs more than "draw two skeletons"
 *
 * Overlaying your swing on a reference is only meaningful if the two are
 * made comparable first, and there are three separate mismatches to remove:
 *
 * 1. **Size.** A 6'4" golfer and a 5'6" golfer trace different-sized arcs
 *    doing identical things. `normalize` divides by torso length so the
 *    comparison is about shape, not height.
 * 2. **Facing.** Two clips are never filmed from exactly the same angle.
 *    `yawAlign` rotates a swing so the stance faces a canonical direction.
 *    Crucially it is computed **once, at address, and applied to every
 *    frame** — computing it per frame would rotate the body back square on
 *    each frame and erase the shoulder turn, which is the very thing a
 *    golfer is trying to see.
 * 3. **Timing.** Two swings are never the same length, and the interesting
 *    comparison is "where were you at the top" not "where were you at
 *    frame 40". `buildTimeWarp` maps primary frames to ghost frames through
 *    their shared events, so address lines up with address and impact with
 *    impact, with linear interpolation between.
 */

export type Point3 = { x: number; y: number; z: number; v: number };
export type Pose3 = Point3[];

export type EventRow = { event: string; frame: number };

const MIN_VISIBILITY = 0.3;

/** Indices per src/lib/metrics/geometry.ts. Duplicated as plain numbers to
 * keep this module dependency-free for testing. */
const L_SHOULDER = 5;
const R_SHOULDER = 6;
const L_HIP = 11;
const R_HIP = 12;

export function isVisible3(p: Point3 | undefined): p is Point3 {
  return !!p && p.v >= MIN_VISIBILITY;
}

/**
 * One frame of the `world` array → render space (y up).
 *
 * Returns null for frames the backend never filled in, which is what a
 * 2D-only pose backend produces — those must not be drawn as a skeleton
 * collapsed at the origin.
 */
export function toRenderSpace(frame: number[][] | undefined): Pose3 | null {
  if (!frame || frame.length === 0) return null;
  const pose: Pose3 = frame.map((k) => ({
    x: k[0] ?? 0,
    y: -(k[1] ?? 0), // world y grows downward; screen space wants up
    z: k[2] ?? 0,
    v: k[3] ?? 0,
  }));
  return pose.some((p) => p.v >= MIN_VISIBILITY) ? pose : null;
}

function midpoint(a: Point3, b: Point3): Point3 {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: (a.z + b.z) / 2,
    v: Math.min(a.v, b.v),
  };
}

/** Torso length — hip centre to shoulder centre. The normalising unit. */
export function torsoLength(pose: Pose3): number | null {
  const ls = pose[L_SHOULDER];
  const rs = pose[R_SHOULDER];
  const lh = pose[L_HIP];
  const rh = pose[R_HIP];
  if (!isVisible3(ls) || !isVisible3(rs) || !isVisible3(lh) || !isVisible3(rh)) {
    return null;
  }
  const s = midpoint(ls, rs);
  const h = midpoint(lh, rh);
  const d = Math.hypot(s.x - h.x, s.y - h.y, s.z - h.z);
  return d > 1e-4 ? d : null;
}

/**
 * Re-centre on the hips and divide by torso length.
 *
 * `unit` lets a whole sequence share one scale factor. Normalising each
 * frame by its own torso length would be wrong: the torso foreshortens as
 * the golfer turns, so a per-frame unit would pump the skeleton larger and
 * smaller through the swing. Measure once at address, apply throughout.
 */
export function normalize(pose: Pose3, unit: number): Pose3 {
  const lh = pose[L_HIP];
  const rh = pose[R_HIP];
  const origin =
    isVisible3(lh) && isVisible3(rh)
      ? midpoint(lh, rh)
      : { x: 0, y: 0, z: 0, v: 1 };
  const k = unit > 1e-6 ? 1 / unit : 1;
  return pose.map((p) => ({
    x: (p.x - origin.x) * k,
    y: (p.y - origin.y) * k,
    z: (p.z - origin.z) * k,
    v: p.v,
  }));
}

/**
 * Yaw (radians) that would turn this pose's hip line onto the +x axis.
 *
 * Measured from the hips rather than the shoulders because the hips stay
 * far closer to square through the swing — using shoulders would fold the
 * golfer's turn into the alignment.
 */
export function yawOf(pose: Pose3): number | null {
  const lh = pose[L_HIP];
  const rh = pose[R_HIP];
  if (!isVisible3(lh) || !isVisible3(rh)) return null;
  return Math.atan2(rh.z - lh.z, rh.x - lh.x);
}

/**
 * Rotate about the vertical (y) axis so `yaw` ends up at zero.
 *
 * This matrix *subtracts* its angle from a point's bearing in the x-z
 * plane, so it takes `yaw` directly rather than `-yaw` — passing the
 * negative rotates the stance further off-axis instead of squaring it up.
 */
export function yawAlign(pose: Pose3, yaw: number): Pose3 {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return pose.map((p) => ({
    x: p.x * c + p.z * s,
    y: p.y,
    z: -p.x * s + p.z * c,
    v: p.v,
  }));
}

/**
 * Map a frame index in the primary swing to one in the ghost swing.
 *
 * Built from events the two swings share. Between two matched events the
 * mapping is linear, which assumes tempo is locally uniform — untrue in
 * detail, but it puts the eight landmarks exactly on top of each other,
 * and those are what a golfer actually compares.
 *
 * Falls back to a plain length ratio when fewer than two events match,
 * which is still better than frame-for-frame on swings of different length.
 */
export function buildTimeWarp(
  primary: EventRow[],
  ghost: EventRow[],
  primaryCount: number,
  ghostCount: number,
): (frame: number) => number {
  const ghostByName = new Map(ghost.map((e) => [e.event, e.frame]));
  const pairs = primary
    .filter((e) => ghostByName.has(e.event))
    .map((e) => [e.frame, ghostByName.get(e.event)!] as const)
    .sort((a, b) => a[0] - b[0]);

  // Anchor both ends so frames before the first event and after the last
  // still map somewhere sensible instead of freezing on a pose.
  const knots: Array<readonly [number, number]> = [
    [0, 0],
    ...pairs,
    [Math.max(1, primaryCount - 1), Math.max(1, ghostCount - 1)],
  ];

  // Strictly increasing in both axes, or the interpolation below divides
  // by zero / runs backwards.
  const clean: Array<readonly [number, number]> = [];
  for (const k of knots) {
    const last = clean[clean.length - 1];
    if (!last || (k[0] > last[0] && k[1] > last[1])) clean.push(k);
  }

  if (clean.length < 2) {
    const ratio = primaryCount > 1 ? (ghostCount - 1) / (primaryCount - 1) : 1;
    return (f) => clampIndex(Math.round(f * ratio), ghostCount);
  }

  return (frame: number) => {
    if (frame <= clean[0]![0]) return clampIndex(clean[0]![1], ghostCount);
    for (let i = 1; i < clean.length; i++) {
      const [pa, ga] = clean[i - 1]!;
      const [pb, gb] = clean[i]!;
      if (frame <= pb) {
        const t = (frame - pa) / (pb - pa);
        return clampIndex(Math.round(ga + t * (gb - ga)), ghostCount);
      }
    }
    return clampIndex(clean[clean.length - 1]![1], ghostCount);
  };
}

function clampIndex(i: number, count: number): number {
  if (!Number.isFinite(i)) return 0;
  return Math.max(0, Math.min(count - 1, i));
}

export type Camera = {
  /** Radians. 0 looks along -z, i.e. face-on to a golfer set up square. */
  azimuth: number;
  /** Radians, positive looks down from above. */
  elevation: number;
  /** Camera distance in torso units. */
  distance: number;
};

export type Projected = { x: number; y: number; depth: number };

/**
 * Perspective-project a normalised point to canvas pixels.
 *
 * `depth` comes back so the caller can paint far bones before near ones —
 * without that, the far arm draws over the near one and the pose reads
 * inside-out.
 */
export function project(
  p: Point3,
  cam: Camera,
  width: number,
  height: number,
  zoom: number,
): Projected {
  const ca = Math.cos(cam.azimuth);
  const sa = Math.sin(cam.azimuth);
  const x1 = p.x * ca + p.z * sa;
  const z1 = -p.x * sa + p.z * ca;

  const ce = Math.cos(cam.elevation);
  const se = Math.sin(cam.elevation);
  const y2 = p.y * ce - z1 * se;
  const z2 = p.y * se + z1 * ce;

  // MediaPipe's convention is that SMALLER z is nearer the camera, so
  // adding z to the camera distance is the right sign: a point in front of
  // the golfer gets a shorter throw and draws larger.
  // Guard the pole: a point at or behind the camera projects to infinity.
  const d = Math.max(0.15, cam.distance + z2);
  const f = (Math.min(width, height) * zoom) / d;

  return {
    x: width / 2 + x1 * f,
    y: height / 2 - y2 * f,
    depth: d,
  };
}

/**
 * Prepare a whole sequence once: normalised, yaw-aligned, ready to draw.
 *
 * Both the scale unit and the yaw come from the reference frame (address
 * when known) and are then applied unchanged to every frame — see the
 * module docstring for why per-frame would be actively wrong.
 */
export function prepareSequence(
  world: number[][][] | null | undefined,
  referenceFrame: number,
): Array<Pose3 | null> | null {
  if (!world || world.length === 0) return null;

  const poses = world.map(toRenderSpace);
  const ref =
    poses[clampIndex(referenceFrame, poses.length)] ??
    poses.find((p): p is Pose3 => p !== null);
  if (!ref) return null;

  const unit = torsoLength(ref);
  if (unit === null) return null;
  const yaw = yawOf(ref) ?? 0;

  return poses.map((p) => (p ? yawAlign(normalize(p, unit), yaw) : null));
}
