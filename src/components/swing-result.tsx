"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

type SwingPayload = {
  swing: {
    id: string;
    status: string;
    blobUrl: string;
    rejectionReason: string | null;
    qualityWarnings: string[] | null;
    club: string | null;
    view: string;
    fps: number | null;
  };
  events: Array<{
    event: string;
    frame: number;
    timestampMs: number;
    confidence: number;
  }>;
  metrics: Array<{
    key: string;
    value: number;
    unit: string;
    phase: string;
    confidence: number;
    targetMin: number | null;
    targetMax: number | null;
  }>;
  faults: Array<{
    code: string;
    severity: number;
    phase: string;
    detectedFrom: string[];
    confidence: number;
  }>;
  score: {
    overall: number;
    setup: number;
    backswing: number;
    top: number;
    downswing: number;
    impact: number;
    finish: number;
  } | null;
  feedback: {
    headline: string;
    primaryFaultCode: string | null;
    body: string;
    drills: Array<{ title: string; cue: string; reps: string }>;
  } | null;
};

const PHASES = [
  "setup",
  "backswing",
  "top",
  "downswing",
  "impact",
  "finish",
] as const;

export function SwingResult({ id }: { id: string }) {
  const [data, setData] = useState<SwingPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openPhase, setOpenPhase] = useState<string | null>("downswing");

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      try {
        const res = await fetch(`/api/swings/${id}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load swing");
        const json = (await res.json()) as SwingPayload;
        if (!alive) return;
        setData(json);
        if (
          json.swing.status === "QUEUED" ||
          json.swing.status === "PROCESSING"
        ) {
          timer = setTimeout(poll, 1500);
        }
      } catch (err) {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Error");
      }
    }

    poll();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [id]);

  if (error) {
    return <p className="text-red-700">{error}</p>;
  }

  if (!data) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-40 rounded bg-[color:var(--mist)]" />
        <div className="aspect-video rounded-xl bg-[color:var(--mist)]" />
      </div>
    );
  }

  const { swing, score, faults, metrics, feedback, events } = data;
  const body = feedback
    ? (JSON.parse(feedback.body) as {
        whatIsHappening: string;
        whyItMatters: string;
        oneThingToFocusOn: string;
      })
    : null;

  if (swing.status === "QUEUED" || swing.status === "PROCESSING") {
    return (
      <div className="space-y-6">
        <Badge variant="secondary">{swing.status}</Badge>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-[color:var(--fairway)]">
          Reading your swing…
        </h1>
        <p className="max-w-lg text-[color:var(--ink-muted)]">
          Mock inference runs about six seconds, then we score, detect faults, and write coaching notes.
        </p>
        <div className="h-2 overflow-hidden rounded-full bg-[color:var(--mist)]">
          <div className="h-full w-1/3 animate-pulse bg-[color:var(--fairway)]" />
        </div>
        <video
          src={swing.blobUrl}
          controls
          className="aspect-[9/16] max-h-[420px] w-full rounded-xl bg-black object-contain sm:aspect-video"
        />
      </div>
    );
  }

  if (swing.status === "REJECTED") {
    return (
      <div className="space-y-4">
        <Badge variant="destructive">REJECTED</Badge>
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-[color:var(--fairway)]">
          Couldn’t analyze this clip
        </h1>
        <p className="max-w-xl text-[color:var(--ink)]">
          {swing.rejectionReason}
        </p>
        <a href="/upload" className="inline-flex text-sm font-medium text-[color:var(--fairway)] underline">
          Re-film and upload again
        </a>
      </div>
    );
  }

  if (swing.status === "FAILED") {
    return (
      <div className="space-y-4">
        <Badge variant="destructive">FAILED</Badge>
        <h1 className="font-[family-name:var(--font-display)] text-3xl">
          Something went wrong
        </h1>
        <p>{swing.rejectionReason ?? "Try uploading again."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {swing.qualityWarnings && swing.qualityWarnings.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Quality warnings: {swing.qualityWarnings.join(", ")}. Advice confidence is reduced.
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <video
            src={swing.blobUrl}
            controls
            className="aspect-[9/16] max-h-[520px] w-full rounded-xl bg-black object-contain sm:aspect-video"
          />
          <div className="flex flex-wrap gap-2">
            {events.map((e) => (
              <span
                key={e.event}
                className="rounded-full bg-[color:var(--mist)] px-2.5 py-1 text-xs text-[color:var(--ink-muted)]"
              >
                {e.event.replaceAll("_", " ")} · {(e.timestampMs / 1000).toFixed(2)}s
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-[color:var(--ink-muted)]">
              Swing score
            </p>
            <p className="font-[family-name:var(--font-display)] text-7xl leading-none text-[color:var(--fairway)]">
              {score?.overall ?? "—"}
            </p>
          </div>

          <div className="space-y-2">
            {PHASES.map((phase) => {
              const value = score?.[phase] ?? 0;
              return (
                <button
                  key={phase}
                  type="button"
                  onClick={() =>
                    setOpenPhase((p) => (p === phase ? null : phase))
                  }
                  className="w-full text-left"
                >
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="capitalize text-[color:var(--ink)]">{phase}</span>
                    <span className="tabular-nums text-[color:var(--ink-muted)]">
                      {value}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[color:var(--mist)]">
                    <div
                      className="h-full bg-[color:var(--fairway)]"
                      style={{ width: `${value}%` }}
                    />
                  </div>
                  {openPhase === phase && (
                    <ul className="mt-2 space-y-1 rounded-lg bg-white/70 p-3 text-xs text-[color:var(--ink-muted)]">
                      {metrics
                        .filter(
                          (m) =>
                            m.phase === phase ||
                            (m.phase === "full" &&
                              (phase === "setup" || phase === "finish")),
                        )
                        .map((m) => (
                          <li key={`${phase}-${m.key}`} className="flex justify-between gap-3">
                            <span>{m.key}</span>
                            <span className="tabular-nums">
                              {m.value}
                              {m.unit === "deg" ? "°" : m.unit === "ms" ? "ms" : ""}
                              {m.targetMin != null && m.targetMax != null
                                ? ` (target ${m.targetMin}–${m.targetMax})`
                                : ""}
                              {m.confidence < 0.5 ? " · low conf" : ""}
                            </span>
                          </li>
                        ))}
                    </ul>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="font-[family-name:var(--font-display)] text-2xl text-[color:var(--fairway)]">
          Faults
        </h2>
        {faults.length === 0 ? (
          <p className="text-[color:var(--ink-muted)]">No major faults surfaced.</p>
        ) : (
          <div className="grid gap-3">
            {faults.map((f, i) => (
              <div
                key={f.code}
                className={`rounded-xl border px-4 py-4 ${
                  i === 0
                    ? "border-[color:var(--fairway)] bg-[color:var(--mist)]"
                    : "border-[color:var(--line)] bg-white/70"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-medium capitalize">
                    {f.code.replaceAll("_", " ")}
                    {i === 0 ? " · primary focus" : ""}
                  </h3>
                  <span className="text-sm tabular-nums text-[color:var(--ink-muted)]">
                    severity {(f.severity * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="mt-1 text-sm text-[color:var(--ink-muted)]">
                  Phase {f.phase} · from {f.detectedFrom.join(", ")}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {feedback && body && (
        <section className="space-y-4 rounded-2xl border border-[color:var(--line)] bg-white/80 p-6">
          <h2 className="font-[family-name:var(--font-display)] text-2xl text-[color:var(--fairway)]">
            {feedback.headline}
          </h2>
          <p>{body.whatIsHappening}</p>
          <p className="text-[color:var(--ink-muted)]">{body.whyItMatters}</p>
          <p className="font-medium">{body.oneThingToFocusOn}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {feedback.drills.map((d) => (
              <div
                key={d.title}
                className="rounded-xl bg-[color:var(--mist)] px-4 py-3"
              >
                <div className="font-medium">{d.title}</div>
                <p className="mt-1 text-sm text-[color:var(--ink-muted)]">{d.cue}</p>
                <p className="mt-2 text-xs uppercase tracking-wide text-[color:var(--fairway)]">
                  {d.reps} reps
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
