import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, formatShortDate } from "./date";

const SAMPLE = new Date("2026-08-04T18:20:00Z");

describe("date formatting", () => {
  it("formats a date the same way regardless of the host time zone", () => {
    // This is the whole point: the server renders in UTC and the browser in
    // the user's zone, and Next compares the two strings.
    const original = process.env.TZ;
    const seen = new Set<string>();
    for (const tz of ["UTC", "America/Los_Angeles", "Asia/Tokyo", "Europe/Berlin"]) {
      process.env.TZ = tz;
      seen.add(formatDate(SAMPLE));
      seen.add(formatShortDate(SAMPLE));
      seen.add(formatDateTime(SAMPLE));
    }
    process.env.TZ = original;
    // One string per formatter, not one per time zone.
    expect(seen.size).toBe(3);
  });

  it("does not roll the date backwards for a western time zone", () => {
    // 18:20 UTC is still the 4th in Los Angeles; an unpinned formatter
    // would agree here but disagree at 23:00 UTC.
    expect(formatShortDate(SAMPLE)).toBe("4 Aug");
    expect(formatDate(SAMPLE)).toBe("4 Aug 2026");
  });

  it("includes the time only in the datetime variant", () => {
    expect(formatDateTime(SAMPLE)).toContain("18:20");
    expect(formatDate(SAMPLE)).not.toContain("18:20");
  });

  it("accepts an ISO string as well as a Date", () => {
    // Drizzle hands back a Date on the server; the same value arrives as a
    // string once it has been through JSON.
    expect(formatDate("2026-08-04T18:20:00Z")).toBe(formatDate(SAMPLE));
    expect(formatDateTime(SAMPLE.getTime())).toBe(formatDateTime(SAMPLE));
  });

  it("returns empty rather than 'Invalid Date' for junk", () => {
    expect(formatDate("not a date")).toBe("");
    expect(formatShortDate(NaN)).toBe("");
    expect(formatDateTime("")).toBe("");
  });
});
