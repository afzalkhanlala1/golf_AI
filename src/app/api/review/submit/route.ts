import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { coachReviewSubmissions } from "@/lib/db/schema";
import { CoachReviewLabels, REVIEW_SAMPLE_ID } from "@/lib/review/labels";
import { getReviewInviteId } from "@/lib/review/session";
import { loadInviteById } from "@/lib/review/board";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const inviteId = await getReviewInviteId();
  if (!inviteId) {
    return NextResponse.json({ error: "Unlock with your access code first." }, { status: 401 });
  }

  const invite = await loadInviteById(inviteId);
  if (!invite) {
    return NextResponse.json({ error: "That access code is not on the list." }, { status: 401 });
  }

  const parsed = CoachReviewLabels.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the scores and faults, then try again." }, { status: 400 });
  }

  const labels = parsed.data;
  const faults =
    labels.primaryFault === "none" || labels.faults.includes(labels.primaryFault)
      ? labels.faults
      : [labels.primaryFault, ...labels.faults];

  const db = getDb();
  await db
    .insert(coachReviewSubmissions)
    .values({
      inviteId,
      sampleId: REVIEW_SAMPLE_ID,
      overallScore: labels.overallScore,
      primaryFault: labels.primaryFault,
      faults,
      notes: labels.notes.trim(),
    })
    .onConflictDoUpdate({
      target: coachReviewSubmissions.inviteId,
      set: {
        sampleId: REVIEW_SAMPLE_ID,
        overallScore: labels.overallScore,
        primaryFault: labels.primaryFault,
        faults,
        notes: labels.notes.trim(),
        submittedAt: new Date(),
      },
    });

  return NextResponse.json({ ok: true });
}
