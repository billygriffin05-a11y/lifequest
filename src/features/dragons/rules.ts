/**
 * Pure dragon growth and mood rules (unit tested in tests/unit/dragon-rules.test.ts).
 *
 * - Growth: an area's dragon grows through 10 stages from that area's total XP.
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
  { name: "Hatching", minXp: 20 },
  { name: "Hatchling", minXp: 60 },
  { name: "Whelp", minXp: 120 },
  { name: "Fledgling", minXp: 200 },
  { name: "Young Drake", minXp: 320 },
  { name: "Drake", minXp: 480 },
  { name: "Wyrm", minXp: 700 },
  { name: "Elder", minXp: 1000 },
  { name: "Ancient", minXp: 1400 },
];

export const STAGE_COUNT = STAGES.length;

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
  joyful: `Thriving — ${JOYFUL_AT}+ Honour this week.`,
  content: "Happy with your progress this week.",
  restless: "Misses you — nothing logged in this area this week.",
  grumpy: "Bad habits are outweighing good deeds this week.",
};
