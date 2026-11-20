/**
 * Achievements: pure badge rules over derived stats (tests: tests/unit/achievements.test.ts).
 * Nothing is stored — badges unlock (and re-lock after an undo) from the ledger.
 */
export interface AchievementStats {
  goodDeeds: number;
  bestStreak: number;
  dragonsHatched: number;
  rankLevel: number;
  notes: number;
  weeksMet: number;
  areas: number;
  cleanWeek: boolean;
}

export interface Achievement {
  id: string;
  icon: string;
  title: string;
  description: string;
  /** [current, goal] for a progress hint on locked badges. */
  progress: (s: AchievementStats) => [number, number];
}

const count = (key: keyof AchievementStats, goal: number) => (s: AchievementStats) =>
  [Math.min(Number(s[key]), goal), goal] as [number, number];

export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: "first-deed", icon: "🗡️", title: "First Blood", description: "Log your first good deed.", progress: count("goodDeeds", 1) },
  { id: "hatch", icon: "🥚", title: "It's Alive!", description: "Hatch your first dragon.", progress: count("dragonsHatched", 1) },
  { id: "streak-7", icon: "🔥", title: "On Fire", description: "Reach a 7-day streak on any good deed.", progress: count("bestStreak", 7) },
  { id: "weekly", icon: "📅", title: "Promise Keeper", description: "Hit a weekly goal.", progress: count("weeksMet", 1) },
  { id: "clean-week", icon: "🧼", title: "Clean Week", description: "7 days in a row with good deeds and no bad habits.", progress: (s) => [s.cleanWeek ? 1 : 0, 1] },
  { id: "knight", icon: "⚔️", title: "Knighted", description: "Reach the rank of Knight.", progress: count("rankLevel", 3) },
  { id: "scribe", icon: "📜", title: "Scribe", description: "Write 10 notes on your deeds.", progress: count("notes", 10) },
  { id: "all-rounder", icon: "🌍", title: "All-Rounder", description: "Good deeds in 5 different life areas.", progress: count("areas", 5) },
  { id: "streak-30", icon: "🌋", title: "Unstoppable", description: "Reach a 30-day streak.", progress: count("bestStreak", 30) },
  { id: "deeds-100", icon: "💯", title: "Centurion", description: "Log 100 good deeds.", progress: count("goodDeeds", 100) },
  { id: "all-hatched", icon: "🐉", title: "Dragon Keeper", description: "Hatch all 8 dragons.", progress: count("dragonsHatched", 8) },
];

export interface AchievementView extends Omit<Achievement, "progress"> {
  unlocked: boolean;
  current: number;
  goal: number;
}

export function evaluate(stats: AchievementStats): AchievementView[] {
  return ACHIEVEMENTS.map(({ progress, ...a }) => {
    const [current, goal] = progress(stats);
    return { ...a, current, goal, unlocked: current >= goal };
  });
}

const DAY = 86_400_000;
const toUtc = (key: string) => Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10));

/** True if there are 7 consecutive days that each had a good deed and no bad habit. */
export function hasCleanWeek(goodDays: ReadonlySet<string>, badDays: ReadonlySet<string>): boolean {
  const clean = [...goodDays].filter((d) => !badDays.has(d)).map(toUtc).sort((a, b) => a - b);
  let run = 0;
  for (let i = 0; i < clean.length; i++) {
    run = i > 0 && clean[i] - clean[i - 1] === DAY ? run + 1 : 1;
    if (run >= 7) return true;
  }
  return false;
}
