import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { swings, users } from "@/lib/db/schema";
import type { SwingSource } from "@/lib/demos";

export type SubmissionSwing = {
  id: string;
  club: string | null;
  view: string;
  status: string;
  blobUrl: string;
  createdAt: Date;
};

export type Submitter = {
  userId: string;
  email: string;
  swingCount: number;
  latestAt: Date;
  latestStatus: string;
  latestSwingId: string;
  swings: SubmissionSwing[];
};

export type SubmissionsLedger = {
  uploads: Submitter[];
  demos: Submitter[];
};

export type SubmissionRow = {
  userId: string;
  email: string;
  source: SwingSource;
  swing: SubmissionSwing;
};

/**
 * Collapse swing rows into people, newest first.
 *
 * Callers must pass rows already ordered by `createdAt` descending so the
 * first swing seen for a person is their latest.
 */
export function groupSubmitters(rows: SubmissionRow[]): Submitter[] {
  const byUser = new Map<string, Submitter>();
  for (const row of rows) {
    const existing = byUser.get(row.userId);
    if (!existing) {
      byUser.set(row.userId, {
        userId: row.userId,
        email: row.email,
        swingCount: 1,
        latestAt: row.swing.createdAt,
        latestStatus: row.swing.status,
        latestSwingId: row.swing.id,
        swings: [row.swing],
      });
      continue;
    }
    existing.swingCount += 1;
    existing.swings.push(row.swing);
  }
  return [...byUser.values()];
}

export async function loadSubmissionsLedger(): Promise<SubmissionsLedger> {
  const db = getDb();
  const rows = await db
    .select({
      userId: users.id,
      email: users.email,
      source: swings.source,
      id: swings.id,
      club: swings.club,
      view: swings.view,
      status: swings.status,
      blobUrl: swings.blobUrl,
      createdAt: swings.createdAt,
    })
    .from(swings)
    .innerJoin(users, eq(users.id, swings.userId))
    .orderBy(desc(swings.createdAt))
    .limit(2000);

  const uploadRows: SubmissionRow[] = [];
  const demoRows: SubmissionRow[] = [];

  for (const row of rows) {
    const mapped: SubmissionRow = {
      userId: row.userId,
      email: row.email,
      source: row.source,
      swing: {
        id: row.id,
        club: row.club,
        view: row.view,
        status: row.status,
        blobUrl: row.blobUrl,
        createdAt: row.createdAt,
      },
    };
    if (row.source === "demo") demoRows.push(mapped);
    else uploadRows.push(mapped);
  }

  return {
    uploads: groupSubmitters(uploadRows),
    demos: groupSubmitters(demoRows),
  };
}
