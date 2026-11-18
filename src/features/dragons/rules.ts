/**
 * Pure dragon growth and mood rules (unit tested in tests/unit/dragon-rules.test.ts).
 *
 * - Growth: an area's dragon grows through 20 stages from that area's total XP.
 *   XP never goes down from bad habits, so a dragon never shrinks (only an
 *   undo of a good entry can reduce XP).
 * - Mood: that area's net Honour over the last 7 days.
 */
export interface Stage {
  name: string;
  minXp: number;
}

export const STAGES: readonly Stage[] = [
  { name: "Egg", minXp: 0 },
  { name: "Glowing Egg", minXp: 15 },
  { name: "Hatching", minXp: 40 },
  { name: "Hatchling", minXp: 75 },
  { name: "Nestling", minXp: 120 },
  { name: "Whelp", minXp: 180 },
  { name: "Fledgling", minXp: 250 },
  { name: "Juvenile", minXp: 340 },
  { name: "Young Drake", minXp: 450 },
  { name: "Drake", minXp: 580 },
  { name: "Wyvern", minXp: 740 },
  { name: "Warden", minXp: 930 },
  { name: "Wyrm", minXp: 1150 },
  { name: "Elder Wyrm", minXp: 1400 },
  { name: "Dread Wyrm", minXp: 1700 },
  { name: "Ancient", minXp: 2050 },
  { name: "Elemental Lord", minXp: 2450 },
  { name: "Primordial", minXp: 2900 },
  { name: "Mythic", minXp: 3400 },
  { name: "Eternal", minXp: 4000 },
];

export const STAGE_COUNT = STAGES.length;

/** Visual milestones (0-based stage index) used by the sprite engine and UI. */
export const UNLOCKS = {
  horns: 5,
  wings: 6,
  breath: 7,
  tailBlade: 8,
  motes: 9,
  spines: 10,
  plates: 11,
  fangs: 12,
  twinHorns: 13,
  crest: 15,
  aura: 18,
  crown: 19,
} as const;

export interface Growth {
  /** 0-based stage index. */
  stage: number;
  stageName: string;
  xp: number;
  /** XP needed for the next stage, or null at the final stage. */
  nextAt: number | null;
  /** 0–100 progress through the current stage. */
  percent: number;
}

export function growthForXp(rawXp: number): Growth {
  const xp = Math.max(0, Math.floor(rawXp));
  let stage = 0;
  for (let i = 0; i < STAGES.length; i++) if (xp >= STAGES[i].minXp) stage = i;
  const next = STAGES[stage + 1];
  const percent = next
    ? Math.floor(((xp - STAGES[stage].minXp) / (next.minXp - STAGES[stage].minXp)) * 100)
    : 100;
  return { stage, stageName: STAGES[stage].name, xp, nextAt: next ? next.minXp : null, percent };
}

export type Mood = "joyful" | "content" | "restless" | "grumpy";

export const JOYFUL_AT = 30;

export function moodFor(recentHonour: number, recentEntries: number): Mood {
  if (recentEntries === 0) return "restless";
  if (recentHonour < 0) return "grumpy";
  if (recentHonour >= JOYFUL_AT) return "joyful";
  return "content";
}

export const MOOD_TEXT: Record<Mood, string> = {
  joyful: "Joyful",
  content: "Content",
  restless: "Restless",
  grumpy: "Grumpy",
};

export const MOOD_HINT: Record<Mood, string> = {
  joyful: `Roaring with power — ${JOYFUL_AT}+ Honour this week.`,
  content: "Happy with your progress this week.",
  restless: "Dozing — nothing logged in this area this week.",
  grumpy: "Sulking in smoke — bad habits outweigh good deeds this week.",
};
