/**
 * Each element's dragon has its own anatomy, not just its own colours.
 * Numbers are multipliers/offsets on the base (Fire) dragon in sprite.ts.
 * Tests: tests/unit/dragon-designs.test.ts
 */
import type { Element } from "./areas";

export type TailStyle = "curl" | "club" | "zigzag" | "wave" | "orb" | "blade" | "fan" | "barb";
export type BackStyle = "spines" | "plates" | "fins" | "shards" | "ridges" | "sail" | "none";
export type WingStyle = "bat" | "stubby" | "jagged" | "fin" | "feather" | "tattered" | "sharp";
export type HornStyle = "swept" | "long" | "nubs" | "forward" | "antlers" | "crystal";

export interface BodyPlan {
  /** Short description shown in the gallery. */
  look: string;
  bodyW: number;
  bodyH: number;
  /** Raise (negative) or lower (positive) the body; longer legs when raised. */
  lift: number;
  /** Neck: head offset from the base position (x forward, y down). */
  neckX: number;
  neckY: number;
  head: number;
  legW: number;
  tail: TailStyle;
  tailLen: number;
  back: BackStyle;
  wing: WingStyle;
  wingSpan: number;
  horns: HornStyle;
}

export const PLANS: Record<Element, BodyPlan> = {
  fire: {
    look: "Classic drake: curled tail, bat wings, swept-back horns.",
    bodyW: 1, bodyH: 1, lift: 0, neckX: 0, neckY: 0, head: 1, legW: 1,
    tail: "curl", tailLen: 1, back: "spines", wing: "bat", wingSpan: 1, horns: "swept",
  },
  earth: {
    look: "Stocky stone-back: heavy body, thick legs, boulder plates and a club tail.",
    bodyW: 1.2, bodyH: 1.18, lift: 1.5, neckX: -2, neckY: 2.5, head: 1.12, legW: 1.6,
    tail: "club", tailLen: 0.75, back: "plates", wing: "stubby", wingSpan: 0.6, horns: "nubs",
  },
  lightning: {
    look: "Lean storm-runner: long legs, jagged wings and a zig-zag bolt tail.",
    bodyW: 0.85, bodyH: 0.8, lift: -2.5, neckX: 1, neckY: -1.5, head: 0.9, legW: 0.8,
    tail: "zigzag", tailLen: 1.15, back: "spines", wing: "jagged", wingSpan: 1.05, horns: "long",
  },
  plasma: {
    look: "Arcane long-neck: a glowing sail, branching antlers and an orb-tipped tail.",
    bodyW: 0.85, bodyH: 0.85, lift: 0, neckX: 3.5, neckY: -4, head: 0.85, legW: 1,
    tail: "orb", tailLen: 1.05, back: "sail", wing: "sharp", wingSpan: 0.95, horns: "antlers",
  },
  water: {
    look: "Sea serpent: long wavy tail with a fluke, fin-wings and a finned back.",
    bodyW: 1.12, bodyH: 0.82, lift: 1, neckX: 1, neckY: -1, head: 1, legW: 0.85,
    tail: "wave", tailLen: 1.35, back: "fins", wing: "fin", wingSpan: 0.9, horns: "swept",
  },
  ice: {
    look: "Crystal wyrm: tall and proud, ice-shard spikes, a crystal horn crown and a blade tail.",
    bodyW: 0.92, bodyH: 1.12, lift: -1.5, neckX: -0.5, neckY: -3, head: 1.05, legW: 1.25,
    tail: "blade", tailLen: 0.95, back: "shards", wing: "sharp", wingSpan: 1.05, horns: "crystal",
  },
  air: {
    look: "Sky glider: slender body, huge feathered wings and a fan tail.",
    bodyW: 0.8, bodyH: 0.78, lift: -2, neckX: 1.5, neckY: -1.5, head: 0.85, legW: 0.75,
    tail: "fan", tailLen: 1.2, back: "none", wing: "feather", wingSpan: 1.25, horns: "long",
  },
  shadow: {
    look: "Hunched wraith: tattered wings, bony ridges and a barbed whip tail.",
    bodyW: 1.15, bodyH: 0.85, lift: 1.5, neckX: -2.5, neckY: 3.5, head: 0.9, legW: 0.8,
    tail: "barb", tailLen: 1.5, back: "ridges", wing: "tattered", wingSpan: 1.1, horns: "forward",
  },
};
