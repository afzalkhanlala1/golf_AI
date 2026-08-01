"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ScorePoint = {
  label: string;
  overall: number;
  earlyExtension?: number | null;
};

export function ProgressCharts({
  points,
  headline,
}: {
  points: ScorePoint[];
  headline: string | null;
}) {
  if (points.length === 0) {
    return (
      <p className="text-[color:var(--ink-muted)]">
        Complete a few swings to unlock trends.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {headline && (
        <p className="rounded-xl bg-[color:var(--mist)] px-4 py-3 text-[color:var(--fairway)]">
          {headline}
        </p>
      )}
      <div className="h-72 w-full rounded-xl border border-[color:var(--line)] bg-white/80 p-4">
        <p className="mb-3 text-sm font-medium">Overall score</p>
        <ResponsiveContainer width="100%" height="90%">
          <LineChart data={points}>
            <CartesianGrid strokeDasharray="3 3" stroke="#d7e0d8" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="overall"
              stroke="#0F3D2E"
              strokeWidth={2.5}
              dot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {points.some((p) => p.earlyExtension != null) && (
        <div className="h-64 w-full rounded-xl border border-[color:var(--line)] bg-white/80 p-4">
          <p className="mb-3 text-sm font-medium">Early extension severity</p>
          <ResponsiveContainer width="100%" height="90%">
            <LineChart data={points}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d7e0d8" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 1]} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="earlyExtension"
                stroke="#A67C52"
                strokeWidth={2.5}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
