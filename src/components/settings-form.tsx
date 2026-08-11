"use client";

import { useEffect, useState } from "react";
import { SectionHead } from "@/components/page-header";
import { LOCALE_NAMES, SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/locales";
import { SPEED_UNITS, SPEED_UNIT_LABEL, type SpeedUnit } from "@/lib/i18n/units";

type Profile = {
  heightCm: number | null;
  wristToFloorCm: number | null;
  handicap: number | null;
  locale: Locale;
  speedUnit: SpeedUnit;
};

const EMPTY: Profile = {
  heightCm: null,
  wristToFloorCm: null,
  handicap: null,
  locale: "en",
  speedUnit: "mph",
};

/** Matches the API's sanity rails, so a bad value is caught before the round
 *  trip rather than coming back as a 400 the golfer has to decode. */
const BOUNDS = {
  heightCm: [120, 230],
  wristToFloorCm: [50, 120],
  handicap: [-10, 54],
} as const;

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-3 border-b border-[color:var(--rule)] py-5 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-start sm:gap-8">
      <div>
        <p className="text-[13.5px]">{label}</p>
        <p className="mt-1.5 max-w-[52ch] text-[11.5px] leading-[1.65] text-[color:var(--muted)]">
          {hint}
        </p>
      </div>
      <div className="sm:justify-self-end">{children}</div>
    </div>
  );
}

const INPUT =
  "w-full rounded-[3px] border border-[color:var(--rule-strong)] bg-[color:var(--surface)] px-3 py-2 text-[13px] text-[color:var(--ink)] outline-none transition focus:border-[color:var(--green)]";

export function SettingsForm() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/profile", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { profile: EMPTY }))
      .then((j: { profile?: Partial<Profile> }) => {
        if (!alive) return;
        setProfile({ ...EMPTY, ...(j.profile ?? {}) });
      })
      .catch(() => alive && setProfile(EMPTY));
    return () => {
      alive = false;
    };
  }, []);

  function set<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile((p) => (p ? { ...p, [key]: value } : p));
    setStatus("idle");
  }

  /** Empty input means "not provided", which is a real state the fitting
   *  engine handles — it is not the same as zero. */
  function num(key: keyof typeof BOUNDS, raw: string) {
    if (raw.trim() === "") return set(key, null);
    const v = Number(raw);
    set(key, Number.isFinite(v) ? v : null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;

    for (const [key, [min, max]] of Object.entries(BOUNDS) as Array<
      [keyof typeof BOUNDS, readonly [number, number]]
    >) {
      const v = profile[key];
      if (v != null && (v < min || v > max)) {
        setStatus("error");
        setError(`${key === "handicap" ? "Handicap" : "Measurement"} must be between ${min} and ${max}.`);
        return;
      }
    }

    setStatus("saving");
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Could not save");
      }
      setStatus("saved");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Could not save");
    }
  }

  if (!profile) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-4 w-40 bg-[color:var(--sunk)]" />
        <div className="h-20 w-full bg-[color:var(--sunk)]" />
      </div>
    );
  }

  return (
    <form onSubmit={save} className="animate-rise">
      <SectionHead title="Display" note="How readings are shown to you" />
      <Row
        label="Speed units"
        hint="Speeds are measured and stored in mph throughout; this converts them at the point of display, so switching never rewrites your history."
      >
        <div className="flex gap-0.5 rounded-[3px] bg-[color:var(--sunk)] p-0.5">
          {SPEED_UNITS.map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => set("speedUnit", u)}
              aria-pressed={profile.speedUnit === u}
              className="flex-1 cursor-pointer rounded-[2px] px-3 py-1.5 text-[12px] transition"
              style={
                profile.speedUnit === u
                  ? {
                      background: "var(--green)",
                      color: "var(--primary-foreground)",
                    }
                  : { color: "var(--muted)" }
              }
            >
              {SPEED_UNIT_LABEL[u]}
            </button>
          ))}
        </div>
      </Row>

      <Row
        label="Language"
        hint="Sets the interface copy and the language your coaching notes are written in. Coaching is written in your language rather than translated after the fact."
      >
        <select
          value={profile.locale}
          onChange={(e) => set("locale", e.target.value as Locale)}
          className={INPUT}
        >
          {SUPPORTED_LOCALES.map((l) => (
            <option key={l} value={l}>
              {LOCALE_NAMES[l]}
            </option>
          ))}
        </select>
      </Row>

      <div className="mt-10">
        <SectionHead title="Your measurements" note="Used by the fitting engine" />
      </div>

      <Row
        label="Height"
        hint="Centimetres. Used as the fallback ruler for club length, and to scale the body when converting pixel speeds into real units."
      >
        <input
          type="number"
          inputMode="decimal"
          min={BOUNDS.heightCm[0]}
          max={BOUNDS.heightCm[1]}
          placeholder="e.g. 178"
          value={profile.heightCm ?? ""}
          onChange={(e) => num("heightCm", e.target.value)}
          className={INPUT}
        />
      </Row>

      <Row
        label="Wrist to floor"
        hint="Centimetres, fingertip to floor standing straight. The measurement fitters actually use — height alone gets club length wrong for anyone whose arms are not average for their height."
      >
        <input
          type="number"
          inputMode="decimal"
          min={BOUNDS.wristToFloorCm[0]}
          max={BOUNDS.wristToFloorCm[1]}
          placeholder="optional"
          value={profile.wristToFloorCm ?? ""}
          onChange={(e) => num("wristToFloorCm", e.target.value)}
          className={INPUT}
        />
      </Row>

      <Row
        label="Handicap"
        hint="Drives shaft flex and how forgiving the recommended head is. Leave blank if you do not have one."
      >
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          min={BOUNDS.handicap[0]}
          max={BOUNDS.handicap[1]}
          placeholder="optional"
          value={profile.handicap ?? ""}
          onChange={(e) => num("handicap", e.target.value)}
          className={INPUT}
        />
      </Row>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={status === "saving"}
          className="cursor-pointer rounded-[3px] border border-[color:var(--green)] px-5 py-2.5 text-[13px] font-semibold tracking-[0.03em] text-[color:var(--green)] transition hover:bg-[color:var(--green-soft)] disabled:opacity-60"
        >
          {status === "saving" ? "Saving…" : "Save settings"}
        </button>
        {status === "saved" ? (
          <span className="text-[12px]" style={{ color: "var(--green)" }}>
            Saved.
          </span>
        ) : null}
        {status === "error" && error ? (
          <span className="text-[12px]" style={{ color: "var(--bad)" }} role="alert">
            {error}
          </span>
        ) : null}
      </div>
    </form>
  );
}
