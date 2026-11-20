import { describe, expect, it } from "vitest";
import { CITY_H, CITY_W, cityRects } from "@/components/ui/neon-city";

describe("neon city backdrop", () => {
  it("is deterministic", () => {
    expect(cityRects()).toEqual(cityRects());
  });

  it("stays on the grid and uses only hex art colours", () => {
    const rects = cityRects();
    expect(rects.length).toBeGreaterThan(100);
    for (const r of rects) {
      expect(r.x + r.w).toBeGreaterThan(-3);
      expect(r.x).toBeLessThan(CITY_W + 3);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.y + r.h).toBeLessThanOrEqual(CITY_H);
      expect(r.fill).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("has neon signs in pink, yellow and cyan", () => {
    const fills = new Set(cityRects().map((r) => r.fill));
    for (const c of ["#ff2bd1", "#ffd23f", "#5ff9ff"]) expect(fills.has(c)).toBe(true);
  });
});
