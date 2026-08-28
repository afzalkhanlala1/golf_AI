import { NextResponse } from "next/server";
import { clearBoardCookie } from "@/lib/review/session";

export const runtime = "nodejs";

export async function POST() {
  await clearBoardCookie();
  return NextResponse.json({ ok: true });
}
