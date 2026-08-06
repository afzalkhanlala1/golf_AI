import { NextResponse } from "next/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { requireUser } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db";
import { swingMetrics, swings, users } from "@/lib/db/schema";
import { fitEquipment } from "@/lib/fitting/engine";

export const runtime = "nodejs";

/** How many recent measurements feed the median. */
const SAMPLE_LIMIT = 5;

/**
 * Median rather than latest or max.
 *
 * One swing is not a fitting. The latest reading rides on whatever the last
 * clip happened to be, and the maximum systematically over-fits — a golfer
 * shown their best-ever number ends up in a shaft too stiff for the swing
 * they make on a Tuesday. The median of recent measured swings is the one
 * that describes how they actually play.
 */
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

export async function GET() {
  const userId = await requireUser();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();

  const [profile] = await db
    .select({
      heightCm: users.heightCm,
      wristToFloorCm: users.wristToFloorCm,
      handicap: users.handicap,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  // Only completed swings this user owns, newest first.
  const rows = await db
    .select({
      key: swingMetrics.key,
      value: swingMetrics.value,
      createdAt: swings.createdAt,
    })
    .from(swingMetrics)
    .innerJoin(swings, eq(swingMetrics.swingId, swings.id))
    .where(
      and(
        eq(swings.userId, userId),
        eq(swings.status, "COMPLETE"),
        inArray(swingMetrics.key, ["clubhead_speed_mph", "attack_angle_deg"]),
      ),
    )
    .orderBy(desc(swings.createdAt));

  const pick = (key: string) =>
    median(
      rows
        .filter((r) => r.key === key)
        .slice(0, SAMPLE_LIMIT)
        .map((r) => r.value),
    );

  const clubheadSpeedMph = pick("clubhead_speed_mph");
  const attackAngleDeg = pick("attack_angle_deg");

  const result = fitEquipment({
    clubheadSpeedMph,
    attackAngleDeg,
    heightCm: profile?.heightCm ?? null,
    wristToFloorCm: profile?.wristToFloorCm ?? null,
    handicap: profile?.handicap ?? null,
  });

  return NextResponse.json({
    ...result,
    inputs: {
      clubheadSpeedMph,
      attackAngleDeg,
      heightCm: profile?.heightCm ?? null,
      wristToFloorCm: profile?.wristToFloorCm ?? null,
      handicap: profile?.handicap ?? null,
      swingsMeasured: rows.filter((r) => r.key === "clubhead_speed_mph").length,
    },
  });
}
