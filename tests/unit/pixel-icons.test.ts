import { describe, expect, it } from "vitest";
import { ICONS } from "@/components/ui/pixel-icon";

const ALLOWED = new Set([..."akbcmdefsgvh."]);

describe("pixel icons", () => {
  it("are all 12×12 and only use theme colour letters", () => {
    for (const [name, rows] of Object.entries(ICONS)) {
      expect(rows, name).toHaveLength(12);
      for (const row of rows) {
        expect(row.length, `${name}: "${row}"`).toBe(12);
        for (const ch of row) expect(ALLOWED.has(ch), `${name} uses "${ch}"`).toBe(true);
      }
    }
  });

  it("are all different and not empty", () => {
    const seen = new Set<string>();
    for (const [name, rows] of Object.entries(ICONS)) {
      const key = rows.join("");
      expect(seen.has(key), name).toBe(false);
      seen.add(key);
      expect(key.replace(/\./g, "").length, name).toBeGreaterThan(15);
    }
  });
});
