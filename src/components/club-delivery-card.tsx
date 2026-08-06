"use client";

import { useEffect, useState } from "react";
import {
  BALL_SPEED_COPY,
  CLUB_SPEED_COPY,
  type BallSpeedReason,
  type ClubSpeedReason,
} from "@/lib/swings/club-copy";
import {
  SPEED_UNITS,
  SPEED_UNIT_LABEL,
  fromMph,
  normalizeSpeedUnit,
  type SpeedUnit,
} from "@/lib/i18n/units";

type Metric = { key: string; value: number; unit: string; confidence: number };

type ClubTracking = {
  tracked: boolean;
  scalePxPerM: number | null;
  speedUnavailableReason: string | null;
  ballUnavailableReason: string | null;
} | null;

/**
 * Club delivery — what the club was doing at the ball.
 *
 * Kept separate from the body metrics because it answers a different
 * question. The body metrics say how you moved; these say what actually
 * arrived at the ball, and they are the numbers a golfer recognises from a
 * launch monitor.
 */
export function ClubDeliveryCard({
  metrics,
  clubTracking,
}: {
  metrics: Metric[];
  clubTracking: ClubTracking;
}) {
  const [unit, setUnit] = useState<SpeedUnit>("mph");

  useEffect(() => {
    fetch("/api/profile", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.profile) setUnit(normalizeSpeedUnit(j.profile.speedUnit));
      })
      .catch(() => {});
  }, []);

  function changeUnit(next: SpeedUnit) {
    setUnit(next);
    void fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ speedUnit: next }),
    }).catch(() => {});
  }

  const by = new Map(metrics.map((m) => [m.key, m]));
  const clubhead = by.get("clubhead_speed_mph");
  const ball = by.get("ball_speed_mph");
  const smash = by.get("smash_factor");
  const attack = by.get("attack_angle_deg");

  const speedReason = clubTracking?.speedUnavailableReason as
    | ClubSpeedReason
    | null
    | undefined;
  const ballReason = clubTracking?.ballUnavailableReason as
    | BallSpeedReason
    | null
    | undefined;

  const hasAny = clubhead || ball || smash || attack;

  return (
    <section className="rounded-xl border border-[color:var(--line)] p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm uppercase tracking-[0.18em] text-[color:var(--ink-muted)]">
          Club delivery
        </h2>
        {(clubhead || ball) && (
          <div className="flex gap-0.5 rounded-md bg-[color:var(--mist)] p-0.5">
            {SPEED_UNITS.map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => changeUnit(u)}
                className={`rounded px-2 py-0.5 text-[11px] transition ${
                  unit === u
                    ? "bg-[color:var(--fairway)] text-[color:var(--primary-foreground)]"
                    : "text-[color:var(--ink-muted)]"
                }`}
              >
                {SPEED_UNIT_LABEL[u]}
              </button>
            ))}
          </div>
        )}
      </div>

      {hasAny ? (
        <>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <Stat
              label="Clubhead speed"
              value={
                clubhead
                  ? fromMph(clubhead.value, unit).toFixed(unit === "kmh" ? 0 : 1)
                  : null
              }
              suffix={SPEED_UNIT_LABEL[unit]}
              confidence={clubhead?.confidence}
            />
            <Stat
              label="Ball speed"
              value={
                ball ? fromMph(ball.value, unit).toFixed(unit === "kmh" ? 0 : 1) : null
              }
              suffix={SPEED_UNIT_LABEL[unit]}
              confidence={ball?.confidence}
            />
            <Stat
              label="Smash factor"
              value={smash ? smash.value.toFixed(2) : null}
              confidence={smash?.confidence}
            />
            <Stat
              label="Attack angle"
              value={attack ? `${attack.value > 0 ? "+" : ""}${attack.value.toFixed(1)}` : null}
              suffix="°"
              confidence={attack?.confidence}
            />
          </div>

          {!ball && ballReason && ballReason !== "needs_clubhead_speed" && (
            <p className="mt-3 text-xs text-[color:var(--ink-muted)]">
              {BALL_SPEED_COPY[ballReason]}
            </p>
          )}

          {attack && (
            <p className="mt-3 text-xs text-[color:var(--ink-muted)]">
              Attack angle is measured in the camera plane. Positive is an
              ascending strike, negative descending — a driver wants one, an
              iron the other, so there is no single target band.
            </p>
          )}
        </>
      ) : speedReason ? (
        <div className="mt-3">
          <p className="text-sm font-medium">
            {CLUB_SPEED_COPY[speedReason]?.headline ?? "Speed unavailable"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[color:var(--ink-muted)]">
            {CLUB_SPEED_COPY[speedReason]?.detail ??
              "Speed could not be measured for this swing."}
          </p>
          {CLUB_SPEED_COPY[speedReason]?.actionable && (
            <p className="mt-2 text-xs text-[color:var(--fairway)]">
              Everything else on this page was measured normally.
            </p>
          )}
        </div>
      ) : (
        <p className="mt-3 text-xs text-[color:var(--ink-muted)]">
          Club tracking hasn&apos;t run for this swing.
        </p>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  suffix,
  confidence,
}: {
  label: string;
  value: string | null;
  suffix?: string;
  confidence?: number;
}) {
  return (
    <div>
      <p className="text-xs text-[color:var(--ink-muted)]">{label}</p>
      <p className="font-[family-name:var(--font-display)] text-3xl leading-tight">
        {value ?? <span className="text-[color:var(--ink-muted)]">—</span>}
        {value && suffix && (
          <span className="ml-1 text-base text-[color:var(--ink-muted)]">{suffix}</span>
        )}
      </p>
      {value && confidence !== undefined && (
        // Confidence is shown because these are computed from a single
        // consumer camera, not a radar unit. A golfer comparing against a
        // launch monitor deserves to know how firm the number is.
        <p className="text-[10px] uppercase tracking-wide text-[color:var(--ink-muted)]">
          {Math.round(confidence * 100)}% confidence
        </p>
      )}
    </div>
  );
}
