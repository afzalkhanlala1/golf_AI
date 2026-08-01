import { auth } from "@clerk/nextjs/server";
import { asc, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { ProgressCharts } from "@/components/progress-charts";
import { getDb } from "@/lib/db";
import { swingFaults, swingScores, swings } from "@/lib/db/schema";

export default async function ProgressPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const db = getDb();
  const rows = await db
    .select({
      id: swings.id,
      createdAt: swings.createdAt,
      overall: swingScores.overall,
    })
    .from(swings)
    .innerJoin(swingScores, eq(swingScores.swingId, swings.id))
    .where(eq(swings.userId, userId))
    .orderBy(asc(swings.createdAt))
    .limit(30);

  const ids = rows.map((r) => r.id);
  const faultRows =
    ids.length === 0
      ? []
      : await db
          .select()
          .from(swingFaults)
          .where(inArray(swingFaults.swingId, ids));

  const points = rows.map((row) => {
    const early = faultRows.find(
      (f) => f.swingId === row.id && f.code === "early_extension",
    );
    return {
      label: row.createdAt.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      overall: row.overall,
      earlyExtension: early?.severity ?? null,
    };
  });

  let headline: string | null = null;
  const eeSeries = points
    .map((p) => p.earlyExtension)
    .filter((n): n is number => n != null);
  if (eeSeries.length >= 2) {
    const first = eeSeries[0]!;
    const last = eeSeries[eeSeries.length - 1]!;
    if (first > 0) {
      const delta = ((first - last) / first) * 100;
      if (delta > 5) {
        headline = `Early extension down ${Math.round(delta)}% over your tracked sessions.`;
      }
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <h1 className="font-[family-name:var(--font-display)] text-4xl text-[color:var(--fairway)]">
        Progress
      </h1>
      <p className="mt-2 text-[color:var(--ink-muted)]">
        Score trend and fault severity over time — the retention surface.
      </p>
      <div className="mt-8">
        <ProgressCharts points={points} headline={headline} />
      </div>
    </main>
  );
}
