import { describe, expect, it } from "vitest";
import {
  ACCESS_CODE_PATTERN,
  codeHint,
  generateAccessCode,
  hashAccessCode,
  hashesMatch,
  normalizeAccessCode,
} from "@/lib/review/codes";

describe("normalizeAccessCode", () => {
  it("trims, drops spaces, and uppercases", () => {
    expect(normalizeAccessCode("  grip-7k2m-p9qx ")).toBe("GRIP-7K2M-P9QX");
    expect(normalizeAccessCode("grip 7k2m p9qx")).toBe("GRIP7K2MP9QX");
  });
});

describe("hashAccessCode", () => {
  it("is stable for the same normalised code", () => {
    const a = hashAccessCode("grip-7k2m-p9qx");
    const b = hashAccessCode("GRIP-7K2M-P9QX");
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
    expect(hashesMatch(a, b)).toBe(true);
  });

  it("differs across codes", () => {
    expect(hashAccessCode("GRIP-7K2M-P9QX")).not.toBe(
      hashAccessCode("GRIP-7K2M-P9QY"),
    );
  });
});

describe("generateAccessCode", () => {
  it("matches the spoken format", () => {
    const code = generateAccessCode();
    expect(code).toMatch(ACCESS_CODE_PATTERN);
    expect(codeHint(code)).toHaveLength(4);
  });
});
