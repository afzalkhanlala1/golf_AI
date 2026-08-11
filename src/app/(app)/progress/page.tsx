import { desc, asc, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Dashboard } from "@/components/progress-charts";
import { PageBody, PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db";
import { swingFaults, swingScores, swings } from "@/lib/db/schema";
import { formatShortDate } from "@/lib/format/date";

export const metadata = {
  title: "Overview · Grip Intelligence",
};

/** Spelled out up to the point where a numeral reads better in a headline. */
const WORDS = [
  "No",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
];

function countWord(n: number): string {
  return n < WORDS.length ? WORDS[n] : String(n);
}

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
    .limit(12);

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
      label: formatShortDate(row.createdAt),
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
  const best = scored.length ? Math.max(...scored.map((r) => r.overall)) : null;
  // Rounded here so the headline's verdict and the figure below it can never
  // disagree — a +0.4 drift should not read as "climbing" beside "holding".
  const delta =
    latest && first && scored.length >= 2
      ? Math.round(latest.overall - first.overall)
      : null;

  // The headline states what the record holds and which way it is going —
  // both read off the data, so it never claims a climb that did not happen.
  const n = scored.length;
  const title =
    n === 0
      ? "Nothing on record yet."
      : `${countWord(n)} ${n === 1 ? "swing" : "swings"} on record.`;
  const accent =
    n === 0
      ? "The first swing starts the line."
      : delta == null
        ? "A second swing starts the line."
        : delta > 0
          ? "The line is climbing."
          : delta < 0
            ? "The line has slipped."
            : "The line is holding.";

  return (
    <PageBody>
      <PageHeader
        kicker="Form guide"
        title={title}
        accent={accent}
        lede="Every reading here was graded against published biomechanics. Anything the camera could not see is left ungraded rather than guessed."
      />

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
          best,
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
    </PageBody>
  );
}
