import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { coachReviewInvites } from "@/lib/db/schema";
import { codeHint, generateAccessCode, hashAccessCode } from "@/lib/review/codes";
import { isBoardUnlocked } from "@/lib/review/session";

export const runtime = "nodejs";

const CreateBody = z.object({
  name: z.string().trim().min(1).max(80),
});

export async function POST(request: Request) {
  if (!(await isBoardUnlocked())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = CreateBody.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter the coach's name." }, { status: 400 });
  }

  const code = generateAccessCode();
  const db = getDb();
  const [invite] = await db
    .insert(coachReviewInvites)
    .values({
      name: parsed.data.name,
      codeHash: hashAccessCode(code),
      codeHint: codeHint(code),
    })
    .returning();

  if (!invite) {
    return NextResponse.json({ error: "Could not create the invite." }, { status: 500 });
  }

  return NextResponse.json({
    inviteId: invite.id,
    name: invite.name,
    code,
    codeHint: invite.codeHint,
  });
}

export async function DELETE(request: Request) {
  if (!(await isBoardUnlocked())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing invite." }, { status: 400 });
  }

  const db = getDb();
  await db.delete(coachReviewInvites).where(eq(coachReviewInvites.id, id));
  return NextResponse.json({ ok: true });
}
