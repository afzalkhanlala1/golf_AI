import { NextResponse } from "next/server";
import { z } from "zod";
import {
  boardSecretConfigured,
  boardSecretMatches,
  setBoardCookie,
} from "@/lib/review/session";

export const runtime = "nodejs";

const Body = z.object({
  secret: z.string().min(1).max(200),
});

export async function POST(request: Request) {
  if (!boardSecretConfigured()) {
    return NextResponse.json(
      { error: "Set COACH_REVIEW_SECRET before opening the board." },
      { status: 503 },
    );
  }

  const parsed = Body.safeParse(await request.json());
  if (!parsed.success || !boardSecretMatches(parsed.data.secret)) {
    return NextResponse.json({ error: "That board password is wrong." }, { status: 401 });
  }

  await setBoardCookie();
  return NextResponse.json({ ok: true });
}
