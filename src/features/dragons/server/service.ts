import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { londonDateKey } from "@/features/honour/rules";
import { getCategoryTotals, getStreakBonusByCategory, listLedger, type LedgerItem } from "@/features/honour/server/service";
import { AREAS, areaForCategory, type Area } from "../areas";
import { growthForXp, moodFor, type Growth, type Mood } from "../rules";
import { MAX_DRAGON_NAME, stageTimeline, type StageReached } from "../timeline";

export const MOOD_WINDOW_DAYS = 7;

export interface DragonView {
  area: Area;
  /** The owner's chosen name, or the default dragon name. */
  displayName: string;
  customName: string | null;
  growth: Growth;
  mood: Mood;
  recentHonour: number;
}

async function profiles(db: PrismaClient): Promise<Map<string, string | null>> {
  const rows = await db.dragonProfile.findMany();
  return new Map(rows.map((r) => [r.areaId, r.customName]));
}

/** One dragon per life area, grown from that area's XP, mood from its last-7-days Honour. */
export async function getDragons(db: PrismaClient, now = new Date()): Promise<DragonView[]> {
  const since = londonDateKey(new Date(now.getTime() - (MOOD_WINDOW_DAYS - 1) * 86_400_000));
  const [totals, streakBonus, names] = await Promise.all([
    getCategoryTotals(db, since),
    getStreakBonusByCategory(db, now),
    profiles(db),
  ]);

  const byArea = new Map<string, { xp: number; recentHonour: number; recentEntries: number }>();
  // Streak / weekly bonus XP also grows the dragon of the area it was earned in.
  for (const [category, bonus] of streakBonus) {
    const id = areaForCategory(category).id;
    const acc = byArea.get(id) ?? { xp: 0, recentHonour: 0, recentEntries: 0 };
    acc.xp += bonus;
    byArea.set(id, acc);
  }
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
    const customName = names.get(area.id) ?? null;
    return {
      area,
      displayName: customName ?? area.dragonName,
      customName,
      growth: growthForXp(acc.xp),
      mood: moodFor(acc.recentHonour, acc.recentEntries),
      recentHonour: acc.recentHonour,
    };
  });
}

// ── Names ────────────────────────────────────────────────────────────────────

export const renameSchema = z
  .object({
    areaId: z.enum(AREAS.map((a) => a.id) as [string, ...string[]]),
    name: z
      .string()
      .trim()
      .max(MAX_DRAGON_NAME, `Names must be ${MAX_DRAGON_NAME} characters or fewer`)
      .transform((s) => (s.length ? s : null)),
  })
  .strict();

/** Rename an area's dragon; an empty name restores the default. */
export async function renameDragon(db: PrismaClient, input: { areaId: string; name: string }): Promise<string | null> {
  const { areaId, name } = renameSchema.parse(input);
  await db.dragonProfile.upsert({ where: { areaId }, create: { areaId, customName: name }, update: { customName: name } });
  await db.auditEvent.create({ data: { actor: "owner", action: "dragon.rename", entityType: "DragonProfile", entityId: areaId } });
  return name;
}

// ── Detail page ──────────────────────────────────────────────────────────────

export interface DragonDetail {
  dragon: DragonView;
  timeline: StageReached[];
  recent: LedgerItem[];
}

export async function getDragonDetail(db: PrismaClient, areaId: string, now = new Date()): Promise<DragonDetail | null> {
  const [dragons, ledger] = await Promise.all([getDragons(db, now), listLedger(db)]);
  const dragon = dragons.find((d) => d.area.id === areaId);
  if (!dragon) return null;
  const inArea = ledger.filter((e) => areaForCategory(e.actionCategory).id === areaId);
  return {
    dragon,
    timeline: stageTimeline(inArea),
    recent: inArea
      .filter((e) => !e.isReversal && !e.undone)
      .slice(-10)
      .reverse(),
  };
}
