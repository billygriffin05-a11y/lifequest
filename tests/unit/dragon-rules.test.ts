import { describe, expect, it } from "vitest";
import { AREAS, areaForCategory } from "@/features/dragons/areas";
import { growthForXp, moodFor, STAGES } from "@/features/dragons/rules";
import { GRID, pixelCount, spriteRuns } from "@/features/dragons/sprite";

describe("dragon growth", () => {
  it("has 10 stages with rising thresholds", () => {
    expect(STAGES).toHaveLength(10);
    for (let i = 1; i < STAGES.length; i++) expect(STAGES[i].minXp).toBeGreaterThan(STAGES[i - 1].minXp);
  });

  it("maps XP to stages at the exact boundaries", () => {
    expect(growthForXp(0).stage).toBe(0);
    expect(growthForXp(19).stage).toBe(0);
    expect(growthForXp(20).stage).toBe(1);
    expect(growthForXp(1399).stage).toBe(8);
    expect(growthForXp(1400)).toMatchObject({ stage: 9, stageName: "Ancient", nextAt: null, percent: 100 });
  });

  it("reports progress within a stage", () => {
    expect(growthForXp(40)).toMatchObject({ stage: 1, nextAt: 60, percent: 50 });
  });

  it("never goes below the egg for negative XP", () => {
    expect(growthForXp(-50)).toMatchObject({ stage: 0, xp: 0 });
  });
});

describe("dragon mood", () => {
  it("is restless with no activity this week", () => expect(moodFor(0, 0)).toBe("restless"));
  it("is grumpy when bad outweighs good", () => expect(moodFor(-5, 3)).toBe("grumpy"));
  it("is content with modest positive Honour", () => expect(moodFor(10, 2)).toBe("content"));
  it("is content when active but balanced", () => expect(moodFor(0, 2)).toBe("content"));
  it("is joyful at 30+ Honour", () => expect(moodFor(30, 2)).toBe("joyful"));
});

describe("areas", () => {
  it("has 8 areas with unique ids and full palettes", () => {
    expect(AREAS).toHaveLength(8);
    expect(new Set(AREAS.map((a) => a.id)).size).toBe(8);
    for (const a of AREAS) expect(Object.values(a.palette).every((c) => /^#[0-9a-f]{6}$/i.test(c))).toBe(true);
  });

  it("maps categories case-insensitively and sends unknown ones to Other", () => {
    expect(areaForCategory("  fitness ").id).toBe("fitness");
    expect(areaForCategory("FINANCE").id).toBe("finance");
    expect(areaForCategory("Gardening").id).toBe("other");
  });
});

describe("pixel sprites", () => {
  it("stays inside the 40x40 grid for every stage and mood", () => {
    for (let s = 0; s < 10; s++) {
      for (const mood of ["joyful", "content", "restless", "grumpy"] as const) {
        for (const r of spriteRuns(s, mood)) {
          expect(r.x).toBeGreaterThanOrEqual(0);
          expect(r.y).toBeGreaterThanOrEqual(0);
          expect(r.x + r.w).toBeLessThanOrEqual(GRID);
          expect(r.y).toBeLessThan(GRID);
        }
      }
    }
  });

  it("dragons get bigger as they grow (hatchling → ancient)", () => {
    const sizes = Array.from({ length: 8 }, (_, i) => pixelCount(spriteRuns(i + 2, "content")));
    for (let i = 1; i < sizes.length; i++) expect(sizes[i]).toBeGreaterThan(sizes[i - 1]);
  });

  it("unlocks features by stage: wings at 5, spikes at 7, aura at 10", () => {
    const roles = (stage: number) => new Set(spriteRuns(stage, "content").map((r) => r.role));
    expect(roles(3).has("wing")).toBe(false);
    expect(roles(4).has("wing")).toBe(true);
    expect(roles(9).has("aura")).toBe(true);
    expect(roles(8).has("aura")).toBe(false);
  });

  it("eggs have no eyes; hatched dragons do", () => {
    expect(spriteRuns(0, "content").some((r) => r.role === "eye")).toBe(false);
    expect(spriteRuns(1, "content").some((r) => r.role === "eye")).toBe(true);
  });

  it("mood changes the face", () => {
    const has = (mood: "joyful" | "content", role: string) => spriteRuns(6, mood).some((r) => r.role === role);
    expect(has("joyful", "blush")).toBe(true);
    expect(has("content", "blush")).toBe(false);
  });

  it("is deterministic", () => {
    expect(JSON.stringify(spriteRuns(7, "grumpy"))).toBe(JSON.stringify(spriteRuns(7, "grumpy")));
  });
});
