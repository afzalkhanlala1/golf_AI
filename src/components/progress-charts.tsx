"use client";

import Link from "next/link";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SectionHead, Stat } from "@/components/page-header";
import { formatShortDate } from "@/lib/format/date";

// Fixed categorical order, validated for CVD separation (see dataviz skill).
// Never reassign — a fault always gets the same slot across renders.
const FAULT_COLORS = ["#1f7a52", "#b8791f", "#3f6fa8", "#c0512f"];

const PHASE_ORDER = [
  ["setup", "Setup"],
  ["backswing", "Backswing"],
  ["top", "Top"],
  ["downswing", "Downswing"],
  ["impact", "Impact"],
  ["finish", "Finish"],
] as const;

function faultLabel(code: string): string {
  return code
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

/** Scores are graded 0–100, so the axis is fixed rather than fitted to the
 *  data — a rescaling axis makes a two-point wobble look like a collapse. */
const Y_MIN = 0;
const Y_MAX = 100;

/**
 * Scores are stored as reals because the scoring maths produces fractions,
 * but a swing graded "88.1" claims a precision single-camera video does not
 * have. Rounded once, here at the display boundary, so the stored value stays
 * exact for comparisons while the page never implies a tenth of a point.
 */
function show(n: number | null | undefined): string {
  return n == null || !Number.isFinite(n) ? "—" : String(Math.round(n));
}

type TrendPoint = Record<string, number | string | null>;

type LatestPhase = {
  setup: number;
  backswing: number;
  top: number;
  downswing: number;
  impact: number;
  finish: number;
} | null;

type Stats = {
  current: number | null;
  delta: number | null;
  avg: number | null;
  best: number | null;
  count: number;
};

type RecentSwing = {
  id: string;
  createdAt: Date;
  club: string | null;
  view: string;
  status: string;
  overall: number | null;
};

/**
 * The score line, drawn by hand rather than by the chart library.
 *
 * At this size the whole point is the hairline — a charting default brings
 * axis furniture, tick marks and padding that would swamp a 190px-tall
 * figure. Coordinates are in viewBox units and the SVG scales to its column.
 */
function TrendLine({ points }: { points: { label: string; score: number }[] }) {
  const W = 660;
  const H = 190;
  const PAD_X = 30;
  const TOP = 30;
  const BASE = 166;

  const x = (i: number) =>
    points.length === 1
      ? W / 2
      : PAD_X + (i * (W - PAD_X * 2)) / (points.length - 1);
  const y = (score: number) =>
    BASE - ((score - Y_MIN) / (Y_MAX - Y_MIN)) * (BASE - TOP);

  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)} ${y(p.score)}`).join(" ");

  // Only the first and last dates are labelled when the run gets long —
  // six labels fit, twenty overlap into noise.
  const labelled = new Set(
    points.length <= 6
      ? points.map((_, i) => i)
      : [0, Math.floor((points.length - 1) / 2), points.length - 1],
  );

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="block h-auto w-full overflow-visible"
      role="img"
      aria-label={`Score trend across ${points.length} graded swings, latest ${points.at(-1)?.score}`}
    >
      {[100, 75, 50, 25].map((score) => (
        <line
          key={score}
          x1="0"
          y1={y(score)}
          x2={W}
          y2={y(score)}
          stroke="var(--rule)"
          strokeWidth="1"
        />
      ))}
      <line x1="0" y1={BASE} x2={W} y2={BASE} stroke="var(--rule-strong)" strokeWidth="1" />
      <text x="0" y={y(100) - 6} fontSize="9" fill="var(--faint)" letterSpacing="1">
        100
      </text>
      <text x="0" y={y(50) - 6} fontSize="9" fill="var(--faint)" letterSpacing="1">
        50
      </text>

      <path
        d={d}
        fill="none"
        stroke="var(--green)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="900"
        className="animate-draw"
      />

      {points.map((p, i) => {
        const last = i === points.length - 1;
        return (
          <circle
            key={i}
            cx={x(i)}
            cy={y(p.score)}
            r={last ? 4.5 : 3}
            fill={last ? "var(--green)" : "var(--surface)"}
            stroke={last ? "none" : "var(--green)"}
            strokeWidth="1.4"
          />
        );
      })}

      {points.map((p, i) =>
        labelled.has(i) ? (
          <text
            key={i}
            x={x(i)}
            y={182}
            fontSize="9.5"
            fill="var(--faint)"
            textAnchor="middle"
          >
            {p.label}
          </text>
        ) : null,
      )}
    </svg>
  );
}

/** Phase scores as a ledger of hairline bars — the design's "checks" row. */
function PhaseRows({ phase }: { phase: NonNullable<LatestPhase> }) {
  return (
    <div>
      {PHASE_ORDER.map(([key, label], i) => {
        const value = phase[key];
        const color =
          value >= 75 ? "var(--green)" : value >= 60 ? "var(--ink)" : "var(--warn)";
        return (
          <div
            key={key}
            className="flex items-center gap-4 border-b border-[color:var(--rule)] py-3"
          >
            <span className="w-5 shrink-0 text-[10.5px] tabular-nums text-[color:var(--faint)]">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="flex-1 text-[13px]">{label}</span>
            <span className="relative block h-[3px] w-[70px] bg-[color:var(--rule)] sm:w-[110px]">
              <span
                className="absolute inset-y-0 left-0"
                style={{ width: `${value}%`, background: color }}
              />
            </span>
            <span
              className="w-9 text-right text-[11.5px] tabular-nums"
              style={{ color }}
            >
              {show(value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const STATUS_TONE: Record<string, string> = {
  COMPLETE: "var(--green)",
  QUEUED: "var(--faint)",
  PROCESSING: "var(--faint)",
  FAILED: "var(--bad)",
  REJECTED: "var(--bad)",
};

export function Dashboard({
  points,
  topFaultCodes,
  latestPhase,
  stats,
  recentSwings,
}: {
  points: TrendPoint[];
  topFaultCodes: string[];
  latestPhase: LatestPhase;
  stats: Stats;
  recentSwings: RecentSwing[];
}) {
  const trend = points
    .map((p) => ({ label: String(p.label), score: Number(p.overall) }))
    .filter((p) => Number.isFinite(p.score));

  if (trend.length === 0) {
    return (
      <div className="animate-rise mt-10 border border-dashed border-[color:var(--rule-strong)] px-6 py-20 text-center">
        <p className="gi-display text-2xl">No graded swings yet</p>
        <p className="mx-auto mt-3 max-w-sm text-[13px] leading-[1.7] text-[color:var(--muted)]">
          Upload a clip and the score trend, fault history and phase breakdown
          start building here. Nothing is shown until there is something real
          to show.
        </p>
        <Link
          href="/upload"
          className="mt-6 inline-block border border-[color:var(--green)] px-5 py-2.5 text-[13px] font-semibold tracking-[0.03em] text-[color:var(--green)] transition hover:bg-[color:var(--green-soft)]"
        >
          Upload your first clip
        </Link>
      </div>
    );
  }

  const delta = stats.delta;

  return (
    <div className="mt-9">
      {/* Latest score against the line it sits on. */}
      <section
        className="animate-rise grid gap-8 border-t border-b border-[color:var(--rule)] py-6 lg:grid-cols-[180px_minmax(0,1fr)] lg:items-center lg:gap-[34px]"
        style={{ animationDelay: "80ms", borderTopColor: "var(--rule-strong)" }}
      >
        <div>
          <p className="gi-kicker">Latest score</p>
          <p className="gi-figure mt-2 text-[76px]">{show(stats.current)}</p>
          <p className="mt-3 text-[12px] leading-[1.6] text-[color:var(--muted)]">
            from {stats.count} graded {stats.count === 1 ? "swing" : "swings"}
          </p>
          {delta != null && trend.length >= 2 ? (
            Math.round(delta) === 0 ? (
              // An arrow beside a zero reads as movement that did not happen.
              <p className="mt-1.5 text-[12px] text-[color:var(--muted)]">
                Holding steady since your first graded swing
              </p>
            ) : (
              <p
                className="mt-1.5 text-[12px] tracking-[0.02em]"
                style={{ color: delta > 0 ? "var(--green)" : "var(--warn)" }}
              >
                {delta > 0 ? "▲" : "▼"} {Math.abs(Math.round(delta))} since your
                first graded swing
              </p>
            )
          ) : (
            <p className="mt-1.5 text-[12px] text-[color:var(--faint)]">
              A second swing starts the trend
            </p>
          )}
        </div>
        <TrendLine points={trend} />
      </section>

      {/* Three figures, divided by rules rather than boxed into cards. */}
      <section
        className="animate-rise mt-7 grid grid-cols-1 gap-6 sm:grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)_1px_minmax(0,1fr)] sm:gap-0"
        style={{ animationDelay: "160ms" }}
      >
        <div className="sm:pr-7">
          <Stat
            label="Average score"
            value={show(stats.avg)}
            note="Across every graded swing on record, not a rolling window."
          />
        </div>
        <div className="hidden bg-[color:var(--rule)] sm:block" />
        <div className="sm:px-7">
          <Stat
            label="Best score"
            value={show(stats.best)}
            note="The highest a swing of yours has graded so far."
          />
        </div>
        <div className="hidden bg-[color:var(--rule)] sm:block" />
        <div className="sm:pl-7">
          <Stat
            label="Swings analysed"
            value={stats.count}
            note="Only swings that completed the pipeline and graded are counted."
          />
        </div>
      </section>

      {/* Latest swing, phase by phase. */}
      {latestPhase ? (
        <section className="animate-rise mt-11" style={{ animationDelay: "240ms" }}>
          <SectionHead title="Latest swing, by phase" note="Address to finish" />
          <div className="mt-1">
            <PhaseRows phase={latestPhase} />
          </div>
        </section>
      ) : null}

      {topFaultCodes.length > 0 ? (
        <section className="animate-rise mt-11" style={{ animationDelay: "300ms" }}>
          <SectionHead
            title="What keeps coming back"
            note="Severity, 0 to 1, per graded swing"
          />
          <div className="mt-5 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                <CartesianGrid stroke="var(--rule)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "var(--faint)" }}
                  axisLine={{ stroke: "var(--rule-strong)" }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 1]}
                  tick={{ fontSize: 11, fill: "var(--faint)" }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 2,
                    border: "1px solid var(--rule-strong)",
                    background: "var(--surface)",
                    color: "var(--ink)",
                    fontSize: 12,
                  }}
                  formatter={(value, name) => [value, faultLabel(String(name))]}
                />
                {topFaultCodes.length > 1 && (
                  <Legend
                    formatter={(value) => (
                      <span style={{ fontSize: 11.5, color: "var(--muted)" }}>
                        {faultLabel(value)}
                      </span>
                    )}
                  />
                )}
                {topFaultCodes.map((code, i) => (
                  <Line
                    key={code}
                    type="monotone"
                    dataKey={code}
                    name={code}
                    stroke={FAULT_COLORS[i % FAULT_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3, strokeWidth: 0 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      ) : null}

      {/* The ledger. */}
      <section className="animate-rise mt-11" style={{ animationDelay: "360ms" }}>
        <SectionHead title="The ledger" note="Every swing, from your first" />
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["No.", "Recorded", "Club · view", "Status", "Score", ""].map((h, i) => (
                  <th
                    key={h + i}
                    className="border-b border-[color:var(--rule)] py-3 pr-2.5 text-[9.5px] font-medium tracking-[0.16em] text-[color:var(--faint)] uppercase"
                    style={{ textAlign: i === 4 ? "right" : "left" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentSwings.map((s, i) => (
                <tr key={s.id} className="gi-row">
                  <td className="py-3.5 pr-2.5 text-[12px] tabular-nums text-[color:var(--faint)]">
                    {String(recentSwings.length - i).padStart(2, "0")}
                  </td>
                  <td className="py-3.5 pr-2.5 text-[13.5px] whitespace-nowrap">
                    {formatShortDate(s.createdAt)}
                  </td>
                  <td className="py-3.5 pr-2.5 text-[12.5px] text-[color:var(--muted)] capitalize">
                    {(s.club ?? "swing").replace("-", " ")} ·{" "}
                    {s.view.replaceAll("_", " ")}
                  </td>
                  <td className="py-3.5 pr-2.5">
                    <span
                      className="text-[10px] tracking-[0.12em] uppercase"
                      style={{ color: STATUS_TONE[s.status] ?? "var(--faint)" }}
                    >
                      {s.status.toLowerCase()}
                    </span>
                  </td>
                  <td
                    className="gi-figure py-3.5 pr-2.5 text-right text-[26px]"
                    style={{
                      color:
                        s.overall == null
                          ? "var(--none)"
                          : s.overall >= 70
                            ? "var(--green)"
                            : s.overall >= 55
                              ? "var(--ink)"
                              : "var(--warn)",
                    }}
                  >
                    {show(s.overall)}
                  </td>
                  <td className="py-3.5 text-right">
                    <Link
                      href={`/swings/${s.id}`}
                      className="text-[11.5px] tracking-[0.08em] text-[color:var(--muted)] uppercase transition hover:text-[color:var(--green)]"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
