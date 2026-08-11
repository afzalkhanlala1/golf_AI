"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SwingPlayer } from "@/components/swing-player";
import { SwingPlayer3D } from "@/components/swing-player-3d";
import { ClubDeliveryCard } from "@/components/club-delivery-card";
import { PageHeader, SectionHead } from "@/components/page-header";
import { formatShortDate } from "@/lib/format/date";

/**
 * Which body region each TPI fault should light up in the overlay, so a
 * fault card and the skeleton agree about where the problem is.
 */
const FAULT_REGION: Record<string, string> = {
  s_posture: "torso",
  c_posture: "torso",
  loss_of_posture: "torso",
  reverse_spine_angle: "torso",
  early_extension: "torso",
  flat_shoulder_plane: "torso",
  over_the_top: "arms",
  casting: "arms",
  chicken_wing: "arms",
  sway: "legs",
  slide: "legs",
  hanging_back: "legs",
};

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
    clubTracking: {
      tracked: boolean;
      scalePxPerM: number | null;
      speedUnavailableReason: string | null;
      ballUnavailableReason: string | null;
    } | null;
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

/** Scores carry more decimals than single-camera video can justify. */
function show(n: number | null | undefined): string {
  return n == null || !Number.isFinite(n) ? "—" : String(Math.round(n));
}

/** snake_case metric keys are database identifiers, not English. */
function humanise(key: string): string {
  const cleaned = key.replace(/_(deg|ms|cm|mph|idx|index)$/, "").replaceAll("_", " ");
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function unitSuffix(unit: string): string {
  if (unit === "deg") return "°";
  if (unit === "ms") return " ms";
  if (unit === "cm") return " cm";
  if (unit === "mph") return " mph";
  return "";
}

function toneForScore(v: number): string {
  return v >= 75 ? "var(--green)" : v >= 60 ? "var(--ink)" : "var(--warn)";
}

/** Shared frame for the states where there is no analysis to show yet. */
function StatusPage({
  kicker,
  title,
  accent,
  lede,
  children,
}: {
  kicker: string;
  title: string;
  accent?: string;
  lede?: string;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <PageHeader kicker={kicker} title={title} accent={accent} lede={lede} />
      {children ? <div className="mt-8">{children}</div> : null}
    </div>
  );
}

export function SwingResult({ id }: { id: string }) {
  const [data, setData] = useState<SwingPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openPhase, setOpenPhase] = useState<string | null>("downswing");
  const [view, setView] = useState<"video" | "3d">("video");
  const [ghostOptions, setGhostOptions] = useState<Array<{ id: string; label: string }>>([]);

  // Other analysed swings, offered as ghost comparisons in the 3D view.
  // Only swings that finished analysis have keypoints to overlay.
  useEffect(() => {
    let alive = true;
    fetch("/api/swings", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { swings: [] }))
      .then((json: { swings?: Array<Record<string, unknown>> }) => {
        if (!alive) return;
        const rows = (json.swings ?? [])
          .filter(
            (s) =>
              s.id !== id && s.status === "COMPLETE" && Boolean(s.keypointsUrl),
          )
          .slice(0, 20)
          .map((s) => {
            const when = s.createdAt
              ? formatShortDate(String(s.createdAt))
              : "earlier";
            return {
              id: String(s.id),
              label: s.club ? `${when} · ${String(s.club)}` : when,
            };
          });
        setGhostOptions(rows);
      })
      .catch(() => {
        // A missing ghost list is not worth surfacing — the 3D view works
        // perfectly well without a comparison, and the picker just hides.
      });
    return () => {
      alive = false;
    };
  }, [id]);

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
    return (
      <StatusPage
        kicker="Swing"
        title="This swing would not load."
        accent={error}
        lede="The record may have been deleted, or the connection dropped mid-request."
      >
        <Link
          href="/swings"
          className="inline-block border border-[color:var(--green)] px-5 py-2.5 text-[13px] font-semibold tracking-[0.03em] text-[color:var(--green)] transition hover:bg-[color:var(--green-soft)]"
        >
          Back to the ledger
        </Link>
      </StatusPage>
    );
  }

  if (!data) {
    return (
      <div className="animate-pulse space-y-5">
        <div className="h-3 w-24 bg-[color:var(--sunk)]" />
        <div className="h-12 w-80 max-w-full bg-[color:var(--sunk)]" />
        <div className="aspect-video w-full bg-[color:var(--sunk)]" />
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
      <StatusPage
        kicker={`Swing · ${swing.status.toLowerCase()}`}
        title="Reading your swing…"
        accent="Pose and events are running."
        lede="Usually one to three minutes for a slow-mo clip, then we score it, detect faults, and write the coaching note. This page updates itself."
      >
        <div className="h-[3px] w-full overflow-hidden bg-[color:var(--rule)]">
          <div className="h-full w-1/3 animate-pulse bg-[color:var(--green)]" />
        </div>
        <video
          src={swing.blobUrl}
          controls
          className="mt-8 aspect-[9/16] max-h-[420px] w-full bg-black object-contain sm:aspect-video"
        />
      </StatusPage>
    );
  }

  if (swing.status === "REJECTED") {
    return (
      <StatusPage
        kicker="Swing · rejected"
        title="We could not read this clip."
        accent="Nothing was graded."
        lede={swing.rejectionReason ?? undefined}
      >
        <Link
          href="/upload"
          className="inline-block border border-[color:var(--green)] px-5 py-2.5 text-[13px] font-semibold tracking-[0.03em] text-[color:var(--green)] transition hover:bg-[color:var(--green-soft)]"
        >
          Re-film and upload again
        </Link>
      </StatusPage>
    );
  }

  if (swing.status === "FAILED") {
    return (
      <StatusPage
        kicker="Swing · failed"
        title="Something went wrong."
        accent="This one is on us."
        lede={swing.rejectionReason ?? "Try uploading the clip again."}
      >
        <Link
          href="/upload"
          className="inline-block border border-[color:var(--green)] px-5 py-2.5 text-[13px] font-semibold tracking-[0.03em] text-[color:var(--green)] transition hover:bg-[color:var(--green-soft)]"
        >
          Upload again
        </Link>
      </StatusPage>
    );
  }

  const graded = metrics.length;
  const clubLabel = (swing.club ?? "swing").replace("-", " ");

  return (
    <div>
      <PageHeader
        kicker={`${clubLabel} · ${swing.view.replaceAll("_", " ")}${swing.fps ? ` · ${swing.fps}fps` : ""}`}
        title={
          score == null
            ? "Analysed, not graded."
            : score.overall >= 75
              ? "A clean read."
              : score.overall >= 60
                ? "Readable, with work to do."
                : "Plenty to work on here."
        }
        accent={`${graded} ${graded === 1 ? "metric" : "metrics"} measured across the swing.`}
        lede="Every phase score below expands into the metrics that produced it — value, target band, and confidence. Anything the camera could not see is left out rather than estimated."
      />

      {swing.qualityWarnings && swing.qualityWarnings.length > 0 && (
        <div
          className="animate-rise mt-8 border-l bg-[color:var(--sunk)] px-5 py-4"
          style={{ borderColor: "var(--warn)" }}
        >
          <p className="gi-kicker" style={{ color: "var(--warn)" }}>
            Capture quality
          </p>
          <p className="mt-2 text-[12.5px] leading-[1.7] text-[color:var(--muted)]">
            {swing.qualityWarnings.join(", ")}. Confidence in the advice below is
            reduced accordingly.
          </p>
        </div>
      )}

      <div className="mt-9 grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <div className="flex gap-6 border-b border-[color:var(--rule)]">
            {(
              [
                ["video", "Video"],
                ["3d", "3D skeleton"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setView(key)}
                aria-pressed={view === key}
                className="relative cursor-pointer pb-3 text-[13px] transition"
                style={{
                  color: view === key ? "var(--ink)" : "var(--muted)",
                  fontWeight: view === key ? 600 : 400,
                }}
              >
                {label}
                {view === key ? (
                  <span className="absolute inset-x-0 -bottom-px h-[2px] bg-[color:var(--green)]" />
                ) : null}
              </button>
            ))}
          </div>

          {/* Both players stay mounted — swapping tabs should not re-fetch
              the keypoint blob or throw away the camera angle the golfer
              just set up. */}
          <div className={view === "video" ? "mt-5" : "hidden"}>
            <SwingPlayer
              swingId={swing.id}
              blobUrl={swing.blobUrl}
              events={events}
              ghostOptions={ghostOptions}
              faultRegions={[
                ...new Set(
                  faults
                    .map((f) => FAULT_REGION[f.code])
                    .filter((r): r is string => !!r),
                ),
              ]}
            />
          </div>
          <div className={view === "3d" ? "mt-5" : "hidden"}>
            <SwingPlayer3D swingId={swing.id} ghostOptions={ghostOptions} />
          </div>
        </div>

        <div>
          <div className="border-t border-b border-[color:var(--rule)] py-5">
            <p className="gi-kicker">Swing score</p>
            <p className="gi-figure mt-2 text-[72px]">{show(score?.overall)}</p>
          </div>

          <div className="mt-1">
            {PHASES.map((phase) => {
              const value = score?.[phase] ?? 0;
              const open = openPhase === phase;
              const rows = metrics.filter(
                (m) =>
                  m.phase === phase ||
                  (m.phase === "full" && (phase === "setup" || phase === "finish")),
              );
              return (
                <div key={phase} className="border-b border-[color:var(--rule)]">
                  <button
                    type="button"
                    onClick={() => setOpenPhase((p) => (p === phase ? null : phase))}
                    aria-expanded={open}
                    className="flex w-full cursor-pointer items-center gap-4 py-3 text-left"
                  >
                    <span className="flex-1 text-[13px] capitalize">{phase}</span>
                    <span className="relative block h-[3px] w-[80px] bg-[color:var(--rule)]">
                      <span
                        className="absolute inset-y-0 left-0"
                        style={{
                          width: `${value}%`,
                          background: toneForScore(value),
                        }}
                      />
                    </span>
                    <span
                      className="w-8 text-right text-[11.5px] tabular-nums"
                      style={{ color: toneForScore(value) }}
                    >
                      {show(value)}
                    </span>
                    <span className="w-3 text-[10px] text-[color:var(--faint)]">
                      {open ? "−" : "+"}
                    </span>
                  </button>
                  {open && (
                    <ul className="mb-3 bg-[color:var(--sunk)] px-3.5 py-3">
                      {rows.length === 0 ? (
                        <li className="text-[11.5px] text-[color:var(--muted)]">
                          Nothing measurable in this phase from this angle.
                        </li>
                      ) : (
                        rows.map((m) => (
                          <li
                            key={`${phase}-${m.key}`}
                            className="flex justify-between gap-3 py-1 text-[11.5px]"
                          >
                            <span className="text-[color:var(--muted)]">
                              {humanise(m.key)}
                            </span>
                            <span className="text-right tabular-nums">
                              {Math.round(m.value * 10) / 10}
                              {unitSuffix(m.unit)}
                              {m.targetMin != null && m.targetMax != null ? (
                                <span className="text-[color:var(--faint)]">
                                  {" "}
                                  (target {m.targetMin}–{m.targetMax})
                                </span>
                              ) : null}
                              {m.confidence < 0.5 ? (
                                <span style={{ color: "var(--warn)" }}> · low conf</span>
                              ) : null}
                            </span>
                          </li>
                        ))
                      )}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-8">
            <ClubDeliveryCard
              metrics={metrics}
              clubTracking={swing.clubTracking ?? null}
            />
          </div>
        </div>
      </div>

      <section className="animate-rise mt-12">
        <SectionHead
          title="Faults"
          note={faults.length > 0 ? "TPI Big 12 · with the metric behind each" : undefined}
        />
        {faults.length === 0 ? (
          <p className="py-6 text-[13px] text-[color:var(--muted)]">
            No major faults surfaced in this swing.
          </p>
        ) : (
          <div>
            {faults.map((f, i) => (
              <div
                key={f.code}
                className="flex flex-wrap items-baseline gap-x-4 gap-y-1.5 border-b border-[color:var(--rule)] py-4"
              >
                <span className="w-5 shrink-0 text-[10.5px] tabular-nums text-[color:var(--faint)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="text-[14px] capitalize">
                  {f.code.replaceAll("_", " ")}
                  {i === 0 ? (
                    <span
                      className="ml-2.5 text-[10px] tracking-[0.12em] uppercase"
                      style={{ color: "var(--green)" }}
                    >
                      primary focus
                    </span>
                  ) : null}
                </h3>
                <span className="ml-auto text-[11.5px] tabular-nums text-[color:var(--muted)]">
                  severity {(f.severity * 100).toFixed(0)}%
                </span>
                <p className="w-full pl-9 text-[11.5px] text-[color:var(--faint)]">
                  {f.phase} · detected from {f.detectedFrom.join(", ")}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {feedback && body && (
        <section className="animate-rise mt-12">
          <SectionHead title="The coaching note" note="Explained, never measured" />
          <div className="mt-6 grid gap-10 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <h3 className="gi-display text-[26px] leading-[1.15]">
                {feedback.headline}
              </h3>
              <p className="mt-4 text-[13.5px] leading-[1.75]">
                {body.whatIsHappening}
              </p>
              <p className="mt-3 text-[13px] leading-[1.75] text-[color:var(--muted)]">
                {body.whyItMatters}
              </p>
              <p className="mt-5 border-l border-[color:var(--green-line)] pl-4 text-[13.5px] leading-[1.75] font-medium">
                {body.oneThingToFocusOn}
              </p>
            </div>
            <div>
              <p className="gi-kicker">Drills</p>
              <div className="mt-3">
                {feedback.drills.map((d) => (
                  <div
                    key={d.title}
                    className="border-b border-[color:var(--rule)] py-3.5"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[13px] font-medium">{d.title}</span>
                      <span className="shrink-0 text-[10px] tracking-[0.12em] text-[color:var(--faint)] uppercase">
                        {d.reps} reps
                      </span>
                    </div>
                    <p className="mt-1.5 text-[11.5px] leading-[1.65] text-[color:var(--muted)]">
                      {d.cue}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
