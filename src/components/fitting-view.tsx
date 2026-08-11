"use client";

import { useCallback, useEffect, useState } from "react";
import type { FittingResult } from "@/lib/fitting/engine";
import { LocalePicker } from "@/components/locale-picker";

type Inputs = {
  clubheadSpeedMph: number | null;
  attackAngleDeg: number | null;
  heightCm: number | null;
  wristToFloorCm: number | null;
  handicap: number | null;
  swingsMeasured: number;
};

type Payload = FittingResult & { inputs: Inputs };

const CATEGORY_LABEL: Record<string, string> = {
  shaft: "Shaft flex",
  loft: "Driver loft",
  length: "Club length",
  irons: "Iron head",
  ball: "Golf ball",
};

export function FittingView() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [height, setHeight] = useState("");
  const [wtf, setWtf] = useState("");
  const [handicap, setHandicap] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/fitting", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not load fitting");
      setData(json as Payload);
      setHeight(json.inputs.heightCm ? String(json.inputs.heightCm) : "");
      setWtf(json.inputs.wristToFloorCm ? String(json.inputs.wristToFloorCm) : "");
      setHandicap(
        json.inputs.handicap !== null ? String(json.inputs.handicap) : "",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const num = (s: string) => (s.trim() === "" ? null : Number(s));
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          heightCm: num(height),
          wristToFloorCm: num(wtf),
          handicap: num(handicap),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not save");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <p className="max-w-[60ch] text-[12.5px] leading-[1.7] text-[color:var(--muted)]">
        Every line below says what it was calculated from. This is where a
        fitting conversation starts, not where it ends — nothing replaces
        hitting real heads on a launch monitor.
      </p>

      {error && (
        <div className="border-l-2 border-[color:var(--warn)] bg-[color:var(--sunk)] px-4 py-3 text-sm leading-relaxed text-[color:var(--muted)]">
          {error}
        </div>
      )}

      <form
        onSubmit={save}
        className="rounded-[2px] border border-[color:var(--line)] p-4"
      >
        <h2 className="text-sm uppercase tracking-[0.18em] text-[color:var(--ink-muted)]">
          Your measurements
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <Field
            label="Height (cm)"
            value={height}
            onChange={setHeight}
            placeholder="180"
          />
          <Field
            label="Wrist-to-floor (cm)"
            value={wtf}
            onChange={setWtf}
            placeholder="88"
            hint="Wrist crease to the ground, flat shoes"
          />
          <Field
            label="Handicap"
            value={handicap}
            onChange={setHandicap}
            placeholder="14"
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-[color:var(--fairway)] px-4 py-2 text-sm text-[color:var(--primary-foreground)] disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save and refit"}
          </button>
          <LocalePicker />
        </div>
      </form>

      {data && (
        <>
          <section className="rounded-[2px] border border-[color:var(--line)] p-4">
            <h2 className="text-sm uppercase tracking-[0.18em] text-[color:var(--ink-muted)]">
              Measured from your swings
            </h2>
            <div className="mt-3 flex flex-wrap gap-6 text-sm">
              <span>
                Clubhead speed:{" "}
                <strong>
                  {data.inputs.clubheadSpeedMph !== null
                    ? `${data.inputs.clubheadSpeedMph.toFixed(1)} mph`
                    : "not measured yet"}
                </strong>
              </span>
              <span>
                Attack angle:{" "}
                <strong>
                  {data.inputs.attackAngleDeg !== null
                    ? `${data.inputs.attackAngleDeg > 0 ? "+" : ""}${data.inputs.attackAngleDeg.toFixed(1)}°`
                    : "not measured yet"}
                </strong>
              </span>
              {data.inputs.swingsMeasured > 0 && (
                <span className="text-[color:var(--ink-muted)]">
                  median of {Math.min(data.inputs.swingsMeasured, 5)} recent
                  measured swing
                  {Math.min(data.inputs.swingsMeasured, 5) === 1 ? "" : "s"}
                </span>
              )}
            </div>
          </section>

          {data.recommendations.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              {data.recommendations.map((r) => (
                <section
                  key={r.category}
                  className="rounded-[2px] border border-[color:var(--line)] p-4"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--ink-muted)]">
                      {CATEGORY_LABEL[r.category] ?? r.category}
                    </p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                        r.confidence === "measured"
                          ? "bg-[color:var(--fairway)]/15 text-[color:var(--fairway)]"
                          : "bg-[color:var(--mist)] text-[color:var(--ink-muted)]"
                      }`}
                    >
                      {r.confidence}
                    </span>
                  </div>
                  <p className="mt-1 font-[family-name:var(--font-display)] text-2xl">
                    {r.title}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-[color:var(--ink-muted)]">
                    {r.detail}
                  </p>
                  <p className="mt-2 text-[11px] text-[color:var(--ink-muted)]">
                    Based on: {r.basedOn.join(", ")}
                  </p>
                </section>
              ))}
            </div>
          )}

          {data.unlocks.length > 0 && (
            <section className="rounded-[2px] border border-[color:var(--line)] p-4">
              <h2 className="text-sm uppercase tracking-[0.18em] text-[color:var(--ink-muted)]">
                To fit the rest
              </h2>
              <ul className="mt-3 space-y-2">
                {data.unlocks.map((u) => (
                  <li key={u} className="flex gap-2 text-sm">
                    <span className="text-[color:var(--fairway)]">→</span>
                    <span className="text-[color:var(--ink-muted)]">{u}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="text-[color:var(--ink-muted)]">{label}</span>
      <input
        type="number"
        step="any"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-[color:var(--line)] bg-transparent px-3 py-2"
      />
      {hint && (
        <span className="mt-1 block text-[11px] text-[color:var(--ink-muted)]">
          {hint}
        </span>
      )}
    </label>
  );
}
