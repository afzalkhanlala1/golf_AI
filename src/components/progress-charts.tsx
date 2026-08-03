"use client";

import Link from "next/link";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";

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

function StatTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "up" | "down" | "neutral";
}) {
  return (
    <div className="rounded-2xl border border-[color:var(--line)] bg-white/80 px-5 py-4">
      <p className="text-xs font-medium tracking-[0.14em] text-[color:var(--ink-muted)] uppercase">
        {label}
      </p>
      <p className="mt-1.5 font-[family-name:var(--font-display)] text-3xl text-[color:var(--fairway)]">
        {value}
      </p>
      {hint && (
        <p
          className={
            "mt-1 text-xs font-medium " +
            (tone === "up"
              ? "text-[#1f7a52]"
              : tone === "down"
                ? "text-[#b3462c]"
                : "text-[color:var(--ink-muted)]")
          }
        >
          {hint}
        </p>
      )}
    </div>
  );
}

const STATUS_VARIANT: Record<string, "secondary" | "destructive" | "outline"> = {
  COMPLETE: "secondary",
  QUEUED: "outline",
  PROCESSING: "outline",
  FAILED: "destructive",
  REJECTED: "destructive",
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
  if (points.length === 0) {
    return (
      <div className="mt-10 rounded-2xl border border-dashed border-[color:var(--line)] px-6 py-16 text-center">
        <p className="font-[family-name:var(--font-display)] text-2xl text-[color:var(--fairway)]">
          No scored swings yet
        </p>
        <p className="mx-auto mt-2 max-w-sm text-[color:var(--ink-muted)]">
          Upload a clip or run a demo swing — your score trend, fault history,
          and phase breakdown will build up here.
        </p>
        <Link
          href="/upload"
          className="mt-5 inline-block text-sm font-medium text-[color:var(--fairway)] underline"
        >
          Upload your first clip
        </Link>
      </div>
    );
  }

  const phaseData = latestPhase
    ? PHASE_ORDER.map(([key, label]) => ({ label, value: latestPhase[key] }))
    : [];

  return (
    <div className="mt-8 space-y-8">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Current score" value={stats.current?.toString() ?? "—"} />
        <StatTile
          label="Trend"
          value={
            stats.delta == null
              ? "—"
              : `${stats.delta > 0 ? "+" : ""}${stats.delta}`
          }
          hint={
            stats.delta == null
              ? "Need 2+ swings"
              : stats.delta > 0
                ? "Improving since your first tracked swing"
                : stats.delta < 0
                  ? "Down since your first tracked swing"
                  : "Holding steady"
          }
          tone={stats.delta == null ? "neutral" : stats.delta > 0 ? "up" : stats.delta < 0 ? "down" : "neutral"}
        />
        <StatTile label="Average score" value={stats.avg?.toString() ?? "—"} />
        <StatTile label="Swings analyzed" value={stats.count.toString()} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="h-80 rounded-2xl border border-[color:var(--line)] bg-white/80 p-5">
          <p className="text-sm font-medium text-[color:var(--ink)]">Overall score</p>
          <ResponsiveContainer width="100%" height="88%">
            <AreaChart data={points} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="overallFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0F3D2E" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="#0F3D2E" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8e3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#5b6b61" }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "#5b6b61" }} axisLine={false} tickLine={false} width={32} />
              <Tooltip
                contentStyle={{ borderRadius: 10, borderColor: "#cfd9d1", fontSize: 13 }}
              />
              <Area
                type="monotone"
                dataKey="overall"
                stroke="#0F3D2E"
                strokeWidth={2.5}
                fill="url(#overallFill)"
                dot={{ r: 3.5, fill: "#0F3D2E", strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="h-80 rounded-2xl border border-[color:var(--line)] bg-white/80 p-5">
          <p className="text-sm font-medium text-[color:var(--ink)]">
            Latest swing · by phase
          </p>
          {phaseData.length === 0 ? (
            <p className="mt-6 text-sm text-[color:var(--ink-muted)]">
              No completed swing yet.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="88%">
              <BarChart data={phaseData} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8e3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#5b6b61" }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "#5b6b61" }} axisLine={false} tickLine={false} width={32} />
                <Tooltip contentStyle={{ borderRadius: 10, borderColor: "#cfd9d1", fontSize: 13 }} />
                <Bar dataKey="value" fill="#0F3D2E" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {topFaultCodes.length > 0 && (
        <div className="h-80 rounded-2xl border border-[color:var(--line)] bg-white/80 p-5">
          <p className="text-sm font-medium text-[color:var(--ink)]">
            Recurring fault severity
          </p>
          <ResponsiveContainer width="100%" height="88%">
            <LineChart data={points} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8e3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#5b6b61" }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 1]} tick={{ fontSize: 12, fill: "#5b6b61" }} axisLine={false} tickLine={false} width={32} />
              <Tooltip contentStyle={{ borderRadius: 10, borderColor: "#cfd9d1", fontSize: 13 }} />
              {topFaultCodes.length > 1 && (
                <Legend
                  formatter={(value) => (
                    <span style={{ fontSize: 12, color: "#5b6b61" }}>{faultLabel(value)}</span>
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
                  strokeWidth={2.5}
                  dot={{ r: 3.5, strokeWidth: 0 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div>
        <p className="mb-3 text-sm font-medium text-[color:var(--ink)]">Recent swings</p>
        <ul className="divide-y divide-[color:var(--line)] overflow-hidden rounded-2xl border border-[color:var(--line)] bg-white/80">
          {recentSwings.map((s) => (
            <li key={s.id}>
              <Link
                href={`/swings/${s.id}`}
                className="flex items-center justify-between gap-3 px-5 py-3.5 transition hover:bg-[color:var(--mist)]"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium capitalize text-[color:var(--ink)]">
                    {(s.club ?? "swing").replace("-", " ")} · {s.view.replaceAll("_", " ")}
                  </p>
                  <p className="text-xs text-[color:var(--ink-muted)]">
                    {s.createdAt.toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {s.overall != null && (
                    <span className="tabular-nums text-sm text-[color:var(--ink-muted)]">
                      {s.overall}
                    </span>
                  )}
                  <Badge variant={STATUS_VARIANT[s.status] ?? "outline"}>{s.status}</Badge>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
