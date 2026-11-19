import { describe, expect, it } from "vitest";
import { CATALOG, COLOURS, itemById } from "@/features/treasury/catalog";
import { canAfford, goldBalance, goldEarned } from "@/features/treasury/rules";

describe("gold", () => {
  it("earns from good Honour, half of bonus XP, and boss wins", () => {
    expect(goldEarned(100, 50, 1)).toBe(100 + 25 + 50);
    expect(goldEarned(-20, 0, 0)).toBe(0);
  });
  it("balance and affordability", () => {
    expect(goldBalance(200, 120)).toBe(80);
    expect(canAfford(80, 80)).toBe(true);
    expect(canAfford(79, 80)).toBe(false);
  });
});

describe("catalogue", () => {
  it("has unique ids, positive prices and only known pixel colours", () => {
    expect(new Set(CATALOG.map((i) => i.id)).size).toBe(CATALOG.length);
    for (const item of CATALOG) {
      expect(item.price).toBeGreaterThan(0);
      for (const row of item.pixels) for (const ch of row) expect(ch === "." || ch in COLOURS).toBe(true);
    }
    expect(itemById("royal-crown")?.name).toBe("Royal Crown");
    expect(itemById("nope")).toBeUndefined();
  });
});
