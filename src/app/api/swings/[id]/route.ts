import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getAuthUserId } from "@/lib/auth/current-user";
import { getDb } from "@/lib/db";
import {
  feedback,
  swingEvents,
  swingFaults,
  swingMetrics,
  swingScores,
  swings,
} from "@/lib/db/schema";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();

  const [swing] = await db
    .select()
    .from(swings)
    .where(and(eq(swings.id, id), eq(swings.userId, userId)))
    .limit(1);

  if (!swing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [events, metrics, faults, scores, fb] = await Promise.all([
    db.select().from(swingEvents).where(eq(swingEvents.swingId, id)),
    db.select().from(swingMetrics).where(eq(swingMetrics.swingId, id)),
    db.select().from(swingFaults).where(eq(swingFaults.swingId, id)),
    db.select().from(swingScores).where(eq(swingScores.swingId, id)).limit(1),
    db.select().from(feedback).where(eq(feedback.swingId, id)).limit(1),
  ]);

  return NextResponse.json({
    swing,
    events,
    metrics,
    faults,
    score: scores[0] ?? null,
    feedback: fb[0] ?? null,
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();

  const [deleted] = await db
    .delete(swings)
    .where(and(eq(swings.id, id), eq(swings.userId, userId)))
    .returning({ id: swings.id });

  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
