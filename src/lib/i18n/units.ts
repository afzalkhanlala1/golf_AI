/**
 * Speed units.
 *
 * Everything upstream — the pipeline, the contract, the `swing_metrics`
 * table — is mph and only mph. Conversion happens once, at the point of
 * display. Storing whichever unit the golfer preferred at upload time would
 * mean every later read has to know which unit that row is in, and the first
 * time someone switches preference their history silently becomes a mix of
 * both.
 */

export const SPEED_UNITS = ["mph", "kmh"] as const;
export type SpeedUnit = (typeof SPEED_UNITS)[number];

export const SPEED_UNIT_LABEL: Record<SpeedUnit, string> = {
  mph: "mph",
  kmh: "km/h",
};

const KMH_PER_MPH = 1.609344;

export function isSpeedUnit(v: unknown): v is SpeedUnit {
  return typeof v === "string" && (SPEED_UNITS as readonly string[]).includes(v);
}

export function normalizeSpeedUnit(v: unknown): SpeedUnit {
  return isSpeedUnit(v) ? v : "mph";
}

/** Convert a stored mph value for display. */
export function fromMph(mph: number, unit: SpeedUnit): number {
  return unit === "kmh" ? mph * KMH_PER_MPH : mph;
}

/**
 * Format for display, with the unit.
 *
 * km/h values are a bigger number for the same speed, so they carry one
 * fewer decimal — "158 km/h" reads better than "157.7 km/h" and implies the
 * same precision the mph figure had.
 */
export function formatSpeed(mph: number, unit: SpeedUnit): string {
  const v = fromMph(mph, unit);
  return `${v.toFixed(unit === "kmh" ? 0 : 1)} ${SPEED_UNIT_LABEL[unit]}`;
}
