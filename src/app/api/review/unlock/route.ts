import { NextResponse } from "next/server";
import { z } from "zod";
import { hashAccessCode } from "@/lib/review/codes";
import { loadInviteByHash, loadSubmissionForInvite } from "@/lib/review/board";
import { setReviewInviteCookie } from "@/lib/review/session";

export const runtime = "nodejs";

const Body = z.object({
  code: z.string().min(4).max(40),
});

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter your access code." }, { status: 400 });
  }

  const invite = await loadInviteByHash(hashAccessCode(parsed.data.code));
  if (!invite) {
    return NextResponse.json({ error: "That access code is not on the list." }, { status: 401 });
  }

  await setReviewInviteCookie(invite.id);
  const existing = await loadSubmissionForInvite(invite.id);

  return NextResponse.json({
    name: invite.name,
    alreadySubmitted: Boolean(existing),
  });
}
