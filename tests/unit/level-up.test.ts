import { describe, expect, it } from "vitest";
import { celebrationsFor, type Milestones } from "@/features/honour/components/level-up";

const base: Milestones = { rankLevel: 1, rankTitle: "Peasant", dragons: { fitness: { stage: 1, stageName: "Glowing Egg", name: "Emberclaw" } } };

describe("level-up celebrations", () => {
  it("stays quiet on the first visit", () => {
    expect(celebrationsFor(null, base)).toEqual([]);
  });
  it("celebrates a new rank and a dragon stage", () => {
    const now: Milestones = { rankLevel: 2, rankTitle: "Squire", dragons: { fitness: { stage: 2, stageName: "Hatching", name: "Emberclaw" } } };
    expect(celebrationsFor(base, now)).toEqual(["⚔️ You've risen to Squire!", "🐉 Emberclaw grew into a Hatching!"]);
  });
  it("doesn't celebrate going down (e.g. after an undo)", () => {
    const now: Milestones = { ...base, dragons: { fitness: { stage: 0, stageName: "Egg", name: "Emberclaw" } } };
    expect(celebrationsFor(base, now)).toEqual([]);
  });
});
