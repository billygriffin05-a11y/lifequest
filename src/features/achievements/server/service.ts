import type { PrismaClient } from "@/generated/prisma/client";
import { areaForCategory } from "@/features/dragons/areas";
import { getDragons } from "@/features/dragons/server/service";
import { getLedgerStats, getPlayerProgress } from "@/features/honour/server/service";
import { evaluate, hasCleanWeek, type AchievementView } from "../rules";

/** Hatching (stage index 2) counts as hatched. */
const HATCHED_STAGE = 2;

export async function getAchievements(db: PrismaClient, now = new Date()): Promise<AchievementView[]> {
  const [stats, progress, dragons] = await Promise.all([getLedgerStats(db, now), getPlayerProgress(db, now), getDragons(db, now)]);
  return evaluate({
    goodDeeds: stats.goodDeeds,
    bestStreak: stats.bestStreak,
    dragonsHatched: dragons.filter((d) => d.growth.stage >= HATCHED_STAGE).length,
    rankLevel: progress.rank.level,
    notes: stats.notes,
    weeksMet: stats.weeksMet,
    areas: new Set([...stats.goodCategories].map((c) => areaForCategory(c).id)).size,
    cleanWeek: hasCleanWeek(stats.goodDays, stats.badDays),
  });
}
