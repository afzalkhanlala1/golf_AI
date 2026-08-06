import { describe, expect, it } from "vitest";
import {
  ballForSpeed,
  driverLoft,
  fitEquipment,
  flexForSpeed,
  ironCategory,
  lengthFromHeight,
  lengthFromWristToFloor,
  type FittingInput,
} from "./engine";

const EMPTY: FittingInput = {
  clubheadSpeedMph: null,
  attackAngleDeg: null,
  heightCm: null,
  wristToFloorCm: null,
  handicap: null,
};

describe("flexForSpeed", () => {
  it("covers the standard bands including their boundaries", () => {
    expect(flexForSpeed(70).flex).toBe("Ladies (L)");
    expect(flexForSpeed(75).flex).toBe("Ladies (L)");
    expect(flexForSpeed(80).flex).toBe("Senior (A)");
    expect(flexForSpeed(84).flex).toBe("Senior (A)");
    expect(flexForSpeed(90).flex).toBe("Regular (R)");
    expect(flexForSpeed(96).flex).toBe("Regular (R)");
    expect(flexForSpeed(100).flex).toBe("Stiff (S)");
    expect(flexForSpeed(104).flex).toBe("Stiff (S)");
    expect(flexForSpeed(110).flex).toBe("Extra Stiff (X)");
  });

  it("never falls off the end for an extreme speed", () => {
    expect(flexForSpeed(200).flex).toBe("Extra Stiff (X)");
    expect(flexForSpeed(1).flex).toBe("Ladies (L)");
  });
});

describe("driverLoft", () => {
  it("gives slower swings more loft", () => {
    expect(driverLoft(80, null)).toBeGreaterThan(driverLoft(110, null));
  });

  it("adds loft for a descending strike and removes it for an ascending one", () => {
    const level = driverLoft(95, 0);
    expect(driverLoft(95, -4)).toBeGreaterThan(level);
    expect(driverLoft(95, 4)).toBeLessThan(level);
  });

  it("stays inside lofts that are actually manufactured", () => {
    for (const mph of [50, 70, 90, 110, 140]) {
      for (const aoa of [-12, -5, 0, 5, 12]) {
        const l = driverLoft(mph, aoa);
        expect(l).toBeGreaterThanOrEqual(7.5);
        expect(l).toBeLessThanOrEqual(15);
        // Half-degree steps, because that is how heads are sold.
        expect(l * 2).toBe(Math.round(l * 2));
      }
    }
  });
});

describe("length", () => {
  it("maps wrist-to-floor to half-inch steps", () => {
    expect(lengthFromWristToFloor(27 * 2.54)).toBe(-1);
    expect(lengthFromWristToFloor(30 * 2.54)).toBe(-0.5);
    expect(lengthFromWristToFloor(33 * 2.54)).toBe(0);
    expect(lengthFromWristToFloor(35 * 2.54)).toBe(0.5);
    expect(lengthFromWristToFloor(37 * 2.54)).toBe(1);
  });

  it("rises monotonically with height", () => {
    const heights = [150, 165, 175, 188, 200];
    const vals = heights.map(lengthFromHeight);
    for (let i = 1; i < vals.length; i++) {
      expect(vals[i]!).toBeGreaterThanOrEqual(vals[i - 1]!);
    }
  });
});

describe("ironCategory", () => {
  it("moves from forgiveness to workability as handicap drops", () => {
    expect(ironCategory(28).title).toContain("Super game improvement");
    expect(ironCategory(15).title).toContain("Game improvement");
    expect(ironCategory(8).title).toContain("Players distance");
    expect(ironCategory(2).title).toBe("Players irons");
  });
});

describe("ballForSpeed", () => {
  it("scales compression with speed", () => {
    expect(ballForSpeed(75).title).toContain("Low compression");
    expect(ballForSpeed(92).title).toContain("Mid compression");
    expect(ballForSpeed(110).title).toContain("Tour");
  });
});

describe("fitEquipment", () => {
  it("returns nothing but unlocks when it knows nothing", () => {
    const r = fitEquipment(EMPTY);
    expect(r.recommendations).toEqual([]);
    expect(r.unlocks.length).toBeGreaterThan(0);
  });

  it("still fits length and irons with no clubhead speed", () => {
    // This is the common case: a 30fps or down-the-line clip yields no
    // speed, and the golfer must still get something real back.
    const r = fitEquipment({
      ...EMPTY,
      heightCm: 180,
      handicap: 14,
    });
    const cats = r.recommendations.map((x) => x.category);
    expect(cats).toContain("length");
    expect(cats).toContain("irons");
    expect(cats).not.toContain("shaft");
    expect(r.unlocks.some((u) => u.includes("face-on"))).toBe(true);
  });

  it("gives the full set when everything is known", () => {
    const r = fitEquipment({
      clubheadSpeedMph: 98,
      attackAngleDeg: -2,
      heightCm: 183,
      wristToFloorCm: 88,
      handicap: 9,
    });
    const cats = r.recommendations.map((x) => x.category);
    expect(new Set(cats)).toEqual(
      new Set(["shaft", "loft", "length", "irons", "ball"]),
    );
    expect(r.recommendations.find((x) => x.category === "shaft")!.title).toBe(
      "Stiff (S)",
    );
    expect(r.unlocks).toEqual([]);
  });

  it("prefers wrist-to-floor over height and says so", () => {
    const withWtf = fitEquipment({
      ...EMPTY,
      heightCm: 180,
      wristToFloorCm: 88,
    });
    const len = withWtf.recommendations.find((x) => x.category === "length")!;
    expect(len.confidence).toBe("measured");
    expect(len.basedOn).toEqual(["Wrist-to-floor"]);
    // And it should not then nag for the measurement it already has.
    expect(withWtf.unlocks.some((u) => u.includes("wrist-to-floor"))).toBe(false);
  });

  it("marks a height-only length as estimated and asks for the better input", () => {
    const r = fitEquipment({ ...EMPTY, heightCm: 180 });
    const len = r.recommendations.find((x) => x.category === "length")!;
    expect(len.confidence).toBe("estimated");
    expect(r.unlocks.some((u) => u.includes("wrist-to-floor"))).toBe(true);
  });

  it("marks loft estimated when attack angle is missing", () => {
    const r = fitEquipment({ ...EMPTY, clubheadSpeedMph: 95 });
    const loft = r.recommendations.find((x) => x.category === "loft")!;
    expect(loft.confidence).toBe("estimated");
  });
});
