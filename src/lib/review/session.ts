import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { isAuthDisabled } from "@/lib/auth-mode";

export const REVIEW_COOKIE = "gi_review";
export const BOARD_COOKIE = "gi_review_board";

function reviewSecret(): string {
  return process.env.COACH_REVIEW_SECRET?.trim() ?? "";
}

function sign(value: string): string {
  const secret = reviewSecret();
  if (!secret) return value;
  const mac = createHmac("sha256", secret).update(value).digest("hex");
  return `${value}.${mac}`;
}

function unsign(token: string): string | null {
  const secret = reviewSecret();
  if (!secret) return token || null;
  const cut = token.lastIndexOf(".");
  if (cut <= 0) return null;
  const value = token.slice(0, cut);
  const mac = token.slice(cut + 1);
  const expected = createHmac("sha256", secret).update(value).digest("hex");
  const a = Buffer.from(mac, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;
  return value;
}

function cookieSecure(): boolean {
  return process.env.NODE_ENV === "production";
}

export async function setReviewInviteCookie(inviteId: string): Promise<void> {
  const jar = await cookies();
  jar.set(REVIEW_COOKIE, sign(inviteId), {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearReviewInviteCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(REVIEW_COOKIE);
}

export async function getReviewInviteId(): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(REVIEW_COOKIE)?.value;
  if (!raw) return null;
  return unsign(raw);
}

export function boardSecretConfigured(): boolean {
  return reviewSecret().length > 0;
}

export function boardSecretMatches(candidate: string): boolean {
  const secret = reviewSecret();
  if (!secret) return false;
  const a = Buffer.from(candidate, "utf8");
  const b = Buffer.from(secret, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function setBoardCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(BOARD_COOKIE, sign("board"), {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function clearBoardCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(BOARD_COOKIE);
}

export async function isBoardUnlocked(): Promise<boolean> {
  if (isAuthDisabled()) return true;
  if (!boardSecretConfigured()) return false;
  const jar = await cookies();
  const raw = jar.get(BOARD_COOKIE)?.value;
  if (!raw) return false;
  return unsign(raw) === "board";
}
