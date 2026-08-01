import { after } from "next/server";
import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { swings } from "@/lib/db/schema";
import { ensureUser } from "@/lib/auth/ensure-user";
import { runInference } from "@/lib/inference/client";
import {
  markFailed,
  markProcessing,
  persistAnalysisResult,
} from "@/lib/swings/process";

export const runtime = "nodejs";
export const maxDuration = 60;

const CreateSwingSchema = z.object({
  blobUrl: z.string().url(),
  view: z.enum(["face_on", "down_the_line", "unknown"]).default("unknown"),
  club: z.string().max(40).optional().nullable(),
});

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(swings)
    .where(eq(swings.userId, userId))
    .orderBy(desc(swings.createdAt))
    .limit(50);

  return NextResponse.json({ swings: rows });
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await currentUser();
  const email =
    user?.emailAddresses[0]?.emailAddress ?? `${userId}@users.clerk.local`;
  await ensureUser(userId, email);

  const body = CreateSwingSchema.parse(await request.json());
  const db = getDb();

  const [swing] = await db
    .insert(swings)
    .values({
      userId,
      blobUrl: body.blobUrl,
      view: body.view,
      club: body.club ?? null,
      status: "QUEUED",
    })
    .returning();

  if (!swing) {
    return NextResponse.json({ error: "Failed to create swing" }, { status: 500 });
  }

  after(async () => {
    try {
      await markProcessing(swing.id);
      const result = await runInference({
        swingId: swing.id,
        blobUrl: body.blobUrl,
        view: body.view,
        club: body.club,
      });
      await persistAnalysisResult(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Analysis failed";
      await markFailed(swing.id, message);
    }
  });

  return NextResponse.json({ swing }, { status: 201 });
}
