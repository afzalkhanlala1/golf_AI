import { describe, expect, it } from "vitest";
import { emailIsAdmin, parseAdminEmails } from "@/lib/auth/admin";

describe("parseAdminEmails", () => {
  it("returns an empty list when unset", () => {
    expect(parseAdminEmails(undefined)).toEqual([]);
    expect(parseAdminEmails(null)).toEqual([]);
    expect(parseAdminEmails("")).toEqual([]);
    expect(parseAdminEmails("  ,  , ")).toEqual([]);
  });

  it("splits, trims, and lowercases", () => {
    expect(
      parseAdminEmails(" Afzal@example.com, adan@example.com ,"),
    ).toEqual(["afzal@example.com", "adan@example.com"]);
  });
});

describe("emailIsAdmin", () => {
  const allowlist = ["owner@grip.test", "ops@grip.test"];

  it("matches case-insensitively", () => {
    expect(emailIsAdmin("Owner@Grip.Test", allowlist)).toBe(true);
    expect(emailIsAdmin(" ops@grip.test ", allowlist)).toBe(true);
  });

  it("rejects everyone when the allowlist is empty", () => {
    expect(emailIsAdmin("owner@grip.test", [])).toBe(false);
  });

  it("rejects emails that are not listed", () => {
    expect(emailIsAdmin("golfer@example.com", allowlist)).toBe(false);
    expect(emailIsAdmin("", allowlist)).toBe(false);
  });
});
