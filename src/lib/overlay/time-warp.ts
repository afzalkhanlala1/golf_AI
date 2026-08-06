/**
 * Aligning two swings in time.
 *
 * Lives here rather than inside the 3D module because both overlay players
 * need it: the 3D ghost and the 2D on-video ghost answer the same question,
 * "which frame of that swing corresponds to this frame of mine".
 *
 * Two swings are never the same length and never the same tempo, and the
 * comparison a golfer wants is "where were you at the top", not "where were
 * you at frame 40". So the mapping runs through the events the two swings
 * share, linearly between them.
 */

export type EventRow = { event: string; frame: number };

/**
 * Map a frame index in the primary swing to one in the ghost swing.
 *
 * Between two matched events the mapping is linear, which assumes tempo is
 * locally uniform — untrue in detail, but it puts the eight landmarks
 * exactly on top of each other, and those are what a golfer compares.
 *
 * Falls back to a plain length ratio when fewer than two events match,
 * which still beats frame-for-frame on swings of different length.
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
  // by zero / runs backwards. Event detection can emit an impact before a
  // top on a bad clip, and the warp still has to be usable.
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

export function clampIndex(i: number, count: number): number {
  if (!Number.isFinite(i)) return 0;
  return Math.max(0, Math.min(count - 1, i));
}
