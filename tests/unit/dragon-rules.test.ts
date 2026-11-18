import { describe, expect, it } from "vitest";
import { AREAS, areaForCategory, type Element } from "@/features/dragons/areas";
import { growthForXp, moodFor, STAGES, UNLOCKS } from "@/features/dragons/rules";
import { GRID_H, GRID_W, pixelCount, spriteLayers, spriteRuns } from "@/features/dragons/sprite";

const ELEMENTS: Element[] = ["fire", "earth", "lightning", "plasma", "water", "ice", "air", "shadow"];
const MOODS = ["joyful", "content", "restless", "grumpy"] as const;

describe("dragon growth", () => {
  it("has 20 stages with rising thresholds", () => {
    expect(STAGES).toHaveLength(20);
    for (let i = 1; i < STAGES.length; i++) expect(STAGES[i].minXp).toBeGreaterThan(STAGES[i - 1].minXp);
  });

  it("maps XP to stages at the exact boundaries", () => {
    expect(growthForXp(0).stage).toBe(0);
    expect(growthForXp(14).stage).toBe(0);
    expect(growthForXp(15).stage).toBe(1);
    expect(growthForXp(3999).stage).toBe(18);
    expect(growthForXp(4000)).toMatchObject({ stage: 19, stageName: "Eternal", nextAt: null, percent: 100 });
  });

  it("reports progress within a stage", () => {
    expect(growthForXp(27)).toMatchObject({ stage: 1, nextAt: 40, percent: 48 });
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
  it("has 8 areas, each a different element, with full palettes", () => {
    expect(AREAS).toHaveLength(8);
    expect(new Set(AREAS.map((a) => a.id)).size).toBe(8);
    expect(new Set(AREAS.map((a) => a.element))).toEqual(new Set(ELEMENTS));
    for (const a of AREAS) expect(Object.values(a.palette).every((c) => /^#[0-9a-f]{6}$/i.test(c))).toBe(true);
  });

  it("maps categories case-insensitively and sends unknown ones to Other", () => {
    expect(areaForCategory("  fitness ").id).toBe("fitness");
    expect(areaForCategory("FINANCE").id).toBe("finance");
    expect(areaForCategory("Gardening").id).toBe("other");
  });
});

describe("pixel sprites", () => {
  it("stays inside the 56x40 grid for every stage, mood and element", () => {
    for (const element of ELEMENTS) {
      for (let s = 0; s < 20; s++) {
        for (const mood of MOODS) {
          const l = spriteLayers(s, mood, element);
          for (const r of [...l.wing, ...l.body, ...l.lids, ...l.breath, ...l.motes.flatMap((m) => m.runs)]) {
            expect(r.x).toBeGreaterThanOrEqual(0);
            expect(r.y).toBeGreaterThanOrEqual(0);
            expect(r.x + r.w).toBeLessThanOrEqual(GRID_W);
            expect(r.y).toBeLessThan(GRID_H);
          }
        }
      }
    }
  });

  it("dragons get bigger as they grow (hatchling → eternal)", () => {
    const sizes = Array.from({ length: 17 }, (_, i) => pixelCount(spriteRuns(i + 3, "content")));
    for (let i = 1; i < sizes.length; i++) expect(sizes[i]).toBeGreaterThanOrEqual(sizes[i - 1]);
    expect(sizes[sizes.length - 1]).toBeGreaterThan(sizes[0] * 2.5);
  });

  it("unlocks features at their stages", () => {
    const roles = (stage: number) => new Set(spriteRuns(stage, "content").map((r) => r.role));
    // Claws already use the horn colour, so horns show up as a jump in horn pixels.
    const hornPx = (stage: number) => pixelCount(spriteRuns(stage, "content").filter((r) => r.role === "horn"));
    expect(hornPx(UNLOCKS.horns)).toBeGreaterThan(hornPx(UNLOCKS.horns - 1) + 3);
    expect(spriteLayers(UNLOCKS.wings - 1, "content", "fire").wing).toHaveLength(0);
    expect(spriteLayers(UNLOCKS.wings, "content", "fire").wing.length).toBeGreaterThan(0);
    expect(roles(UNLOCKS.aura - 1).has("aura")).toBe(false);
    expect(roles(UNLOCKS.aura).has("aura")).toBe(true);
    expect(spriteLayers(UNLOCKS.motes - 1, "content", "fire").motes).toHaveLength(0);
    expect(spriteLayers(UNLOCKS.motes, "content", "fire").motes.length).toBeGreaterThan(0);
  });

  it("every element breathes its own attack once the dragon is old enough", () => {
    const signatures = new Set<string>();
    for (const element of ELEMENTS) {
      expect(spriteLayers(UNLOCKS.breath - 1, "content", element).breath).toHaveLength(0);
      const b = spriteLayers(15, "content", element).breath;
      expect(b.length).toBeGreaterThan(0);
      signatures.add(JSON.stringify(b.map((r) => [r.x, r.y, r.w])));
    }
    expect(signatures.size).toBe(ELEMENTS.length); // all shapes differ
  });

  it("joyful dragons breathe further; restless don't breathe; grumpy only puff smoke", () => {
    const reach = (mood: (typeof MOODS)[number]) =>
      Math.max(0, ...spriteLayers(15, mood, "fire").breath.map((r) => r.x + r.w));
    expect(reach("joyful")).toBeGreaterThan(reach("content"));
    expect(spriteLayers(15, "restless", "fire").breath).toHaveLength(0);
    expect(reach("grumpy")).toBeLessThan(reach("content"));
  });

  it("eggs have no eyes; the hatching dragon peeks out; grown dragons have glowing eyes and fangs", () => {
    expect(spriteRuns(0, "content").some((r) => r.role === "eye")).toBe(false);
    expect(spriteRuns(1, "content").some((r) => r.role === "glow")).toBe(true); // glowing cracks
    expect(spriteRuns(2, "content").some((r) => r.role === "eye")).toBe(true);
    const grown = spriteRuns(UNLOCKS.fangs, "content");
    expect(grown.some((r) => r.role === "glow")).toBe(true);
    expect(grown.some((r) => r.role === "eyeShine")).toBe(true);
  });

  it("blink lids cover exactly the eye pixels", () => {
    const l = spriteLayers(14, "content", "water");
    expect(l.lids.length).toBeGreaterThan(0);
    const body = new Set(l.body.flatMap((r) => Array.from({ length: r.w }, (_, i) => `${r.x + i},${r.y}`)));
    for (const lid of l.lids) expect(body.has(`${lid.x},${lid.y}`)).toBe(true);
  });

  it("young dragons blush when joyful", () => {
    expect(spriteRuns(4, "joyful").some((r) => r.role === "blush")).toBe(true);
    expect(spriteRuns(4, "content").some((r) => r.role === "blush")).toBe(false);
  });

  it("is deterministic", () => {
    expect(JSON.stringify(spriteLayers(17, "grumpy", "plasma"))).toBe(JSON.stringify(spriteLayers(17, "grumpy", "plasma")));
  });
});
