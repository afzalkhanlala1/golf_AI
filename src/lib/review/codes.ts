import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** Alphabet without 0/O/1/I so a code read over the phone still types. */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function normalizeAccessCode(raw: string): string {
  return raw.replace(/\s+/g, "").trim().toUpperCase();
}

export function hashAccessCode(raw: string): string {
  const normalised = normalizeAccessCode(raw);
  return createHash("sha256").update(normalised, "utf8").digest("hex");
}

export function hashesMatch(left: string, right: string): boolean {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function codeHint(raw: string): string {
  const normalised = normalizeAccessCode(raw);
  return normalised.slice(-4);
}

/**
 * `GRIP-XXXX-XXXX` — eight information characters, grouped for reading aloud.
 */
export function generateAccessCode(): string {
  const bytes = randomBytes(8);
  let chars = "";
  for (const byte of bytes) {
    chars += ALPHABET[byte % ALPHABET.length] ?? "2";
  }
  return `GRIP-${chars.slice(0, 4)}-${chars.slice(4, 8)}`;
}

export const ACCESS_CODE_PATTERN = /^GRIP-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/;
