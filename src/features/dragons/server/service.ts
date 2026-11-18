import type { PrismaClient } from "@/generated/prisma/client";
import { londonDateKey } from "@/features/honour/rules";
import { getCategoryTotals } from "@/features/honour/server/service";
import { AREAS, areaForCategory, type Area } from "../areas";
import { growthForXp, moodFor, type Growth, type Mood } from "../rules";

export const MOOD_WINDOW_DAYS = 7;

export interface DragonView {
  area: Area;
  growth: Growth;
  mood: Mood;
  recentHonour: number;
}

/** One dragon per life area, grown from that area's XP, mood from its last-7-days Honour. */
export async function getDragons(db: PrismaClient, now = new Date()): Promise<DragonView[]> {
  const since = londonDateKey(new Date(now.getTime() - (MOOD_WINDOW_DAYS - 1) * 86_400_000));
  const totals = await getCategoryTotals(db, since);

  const byArea = new Map<string, { xp: number; recentHonour: number; recentEntries: number }>();
  for (const t of totals) {
    const id = areaForCategory(t.category).id;
    const acc = byArea.get(id) ?? { xp: 0, recentHonour: 0, recentEntries: 0 };
    acc.xp += t.xp;
    acc.recentHonour += t.recentHonour;
    acc.recentEntries += t.recentEntries;
    byArea.set(id, acc);
  }

  return AREAS.map((area) => {
    const acc = byArea.get(area.id) ?? { xp: 0, recentHonour: 0, recentEntries: 0 };
    return {
      area,
      growth: growthForXp(acc.xp),
      mood: moodFor(acc.recentHonour, acc.recentEntries),
      recentHonour: acc.recentHonour,
    };
  });
}
