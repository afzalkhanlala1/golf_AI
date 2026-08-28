import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  coachReviewInvites,
  coachReviewSubmissions,
} from "@/lib/db/schema";

export type CoachReviewRow = {
  inviteId: string;
  name: string;
  codeHint: string;
  invitedAt: Date;
  submitted: boolean;
  submittedAt: Date | null;
  overallScore: number | null;
  primaryFault: string | null;
  faults: string[];
  notes: string;
  sampleId: string | null;
};

export function mergeInvitesWithSubmissions(
  invites: Array<{
    id: string;
    name: string;
    codeHint: string;
    createdAt: Date;
  }>,
  submissions: Array<{
    inviteId: string;
    submittedAt: Date;
    overallScore: number;
    primaryFault: string;
    faults: string[] | null;
    notes: string;
    sampleId: string;
  }>,
): CoachReviewRow[] {
  const byInvite = new Map(submissions.map((row) => [row.inviteId, row]));
  return invites.map((invite) => {
    const submission = byInvite.get(invite.id);
    return {
      inviteId: invite.id,
      name: invite.name,
      codeHint: invite.codeHint,
      invitedAt: invite.createdAt,
      submitted: Boolean(submission),
      submittedAt: submission?.submittedAt ?? null,
      overallScore: submission?.overallScore ?? null,
      primaryFault: submission?.primaryFault ?? null,
      faults: submission?.faults ?? [],
      notes: submission?.notes ?? "",
      sampleId: submission?.sampleId ?? null,
    };
  });
}

export async function loadCoachReviewBoard(): Promise<CoachReviewRow[]> {
  const db = getDb();
  const [invites, submissions] = await Promise.all([
    db
      .select()
      .from(coachReviewInvites)
      .orderBy(desc(coachReviewInvites.createdAt)),
    db.select().from(coachReviewSubmissions),
  ]);

  return mergeInvitesWithSubmissions(invites, submissions);
}

export async function loadInviteByHash(codeHash: string) {
  const db = getDb();
  const [invite] = await db
    .select()
    .from(coachReviewInvites)
    .where(eq(coachReviewInvites.codeHash, codeHash))
    .limit(1);
  return invite ?? null;
}

export async function loadInviteById(id: string) {
  const db = getDb();
  const [invite] = await db
    .select()
    .from(coachReviewInvites)
    .where(eq(coachReviewInvites.id, id))
    .limit(1);
  return invite ?? null;
}

export async function loadSubmissionForInvite(inviteId: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(coachReviewSubmissions)
    .where(eq(coachReviewSubmissions.inviteId, inviteId))
    .limit(1);
  return row ?? null;
}
