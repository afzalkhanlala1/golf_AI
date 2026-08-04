import { desc, asc, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Dashboard } from "@/components/progress-charts";
import { requireUser } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db";
import { swingFaults, swingScores, swings } from "@/lib/db/schema";

export default async function ProgressPage() {
  const userId = await requireUser();
  if (!userId) redirect("/sign-in");

  const db = getDb();

  const scored = await db
    .select({
      id: swings.id,
      createdAt: swings.createdAt,
      overall: swingScores.overall,
      setup: swingScores.setup,
      backswing: swingScores.backswing,
      top: swingScores.top,
      downswing: swingScores.downswing,
      impact: swingScores.impact,
      finish: swingScores.finish,
    })
    .from(swings)
    .innerJoin(swingScores, eq(swingScores.swingId, swings.id))
    .where(eq(swings.userId, userId))
    .orderBy(asc(swings.createdAt))
    .limit(30);

  const ids = scored.map((r) => r.id);
  const faultRows =
    ids.length === 0
      ? []
      : await db
          .select()
          .from(swingFaults)
          .where(inArray(swingFaults.swingId, ids));

  const recent = await db
    .select({
      id: swings.id,
      createdAt: swings.createdAt,
      club: swings.club,
      view: swings.view,
      status: swings.status,
      overall: swingScores.overall,
    })
    .from(swings)
    .leftJoin(swingScores, eq(swingScores.swingId, swings.id))
    .where(eq(swings.userId, userId))
    .orderBy(desc(swings.createdAt))
    .limit(8);

  // Rank faults by how often they show up so the trend chart tracks what
  // actually recurs for this golfer, not a fixed fault list.
  const faultCounts = new Map<string, number>();
  for (const f of faultRows) {
    faultCounts.set(f.code, (faultCounts.get(f.code) ?? 0) + 1);
  }
  const topFaultCodes = [...faultCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([code]) => code);

  const points = scored.map((row) => {
    const point: Record<string, number | string | null> = {
      label: row.createdAt.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      overall: row.overall,
    };
    for (const code of topFaultCodes) {
      const hit = faultRows.find((f) => f.swingId === row.id && f.code === code);
      point[code] = hit ? hit.severity : null;
    }
    return point;
  });

  const latest = scored.at(-1) ?? null;
  const first = scored[0] ?? null;
  const avgScore = scored.length
    ? Math.round(scored.reduce((sum, r) => sum + r.overall, 0) / scored.length)
    : null;
  const delta =
    latest && first && scored.length >= 2 ? latest.overall - first.overall : null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <h1 className="font-[family-name:var(--font-display)] text-4xl text-[color:var(--fairway)]">
        Dashboard
      </h1>
      <p className="mt-2 text-[color:var(--ink-muted)]">
        Score trend, recurring faults, and the phase breakdown of your latest swing.
      </p>

      <Dashboard
        points={points}
        topFaultCodes={topFaultCodes}
        latestPhase={
          latest
            ? {
                setup: latest.setup,
                backswing: latest.backswing,
                top: latest.top,
                downswing: latest.downswing,
                impact: latest.impact,
                finish: latest.finish,
              }
            : null
        }
        stats={{
          current: latest?.overall ?? null,
          delta,
          avg: avgScore,
          count: scored.length,
        }}
        recentSwings={recent.map((r) => ({
          id: r.id,
          createdAt: r.createdAt,
          club: r.club,
          view: r.view,
          status: r.status,
          overall: r.overall,
        }))}
      />
    </main>
  );
}
