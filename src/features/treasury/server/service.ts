import { z } from "zod";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { AREAS } from "@/features/dragons/areas";
import { getPlayerProgress } from "@/features/honour/server/service";
import { CATALOG, itemById } from "../catalog";
import { SEASONS, seasonFor } from "../seasons";
import { londonDateKey } from "@/features/honour/rules";
import { canAfford, goldBalance, goldEarned } from "../rules";

export class TreasuryError extends Error {}

export interface Treasury {
  earned: number;
  spent: number;
  balance: number;
  owned: Set<string>;
  /** areaId → equipped item id */
  equipped: Record<string, string | null>;
}

export async function getTreasury(db: PrismaClient, now = new Date()): Promise<Treasury> {
  const [progress, purchases, profiles] = await Promise.all([
    getPlayerProgress(db, now),
    db.purchase.findMany(),
    db.dragonProfile.findMany({ select: { areaId: true, accessory: true } }),
  ]);
  const earned = goldEarned(progress.goodHonour, progress.bonusXp, progress.bossWins);
  const spent = purchases.reduce((n, p) => n + p.price, 0);
  return {
    earned,
    spent,
    balance: goldBalance(earned, spent),
    owned: new Set(purchases.map((p) => p.itemId)),
    equipped: Object.fromEntries(profiles.map((p) => [p.areaId, p.accessory])),
  };
}

const itemIdSchema = z.enum(CATALOG.map((i) => i.id) as [string, ...string[]]);
const areaIdSchema = z.enum(AREAS.map((a) => a.id) as [string, ...string[]]);

/** Buy an item once. Price comes from the server catalogue, never the client. */
export async function buyItem(db: PrismaClient, rawItemId: string, now = new Date()): Promise<void> {
  const itemId = itemIdSchema.parse(rawItemId);
  const item = itemById(itemId)!;
  const t = await getTreasury(db, now);
  if (t.owned.has(itemId)) throw new TreasuryError("You already own that.");
  if (item.season && seasonFor(londonDateKey(now)) !== item.season) {
    throw new TreasuryError(`${item.name} is only sold during the ${SEASONS[item.season].festival}.`);
  }
  if (!canAfford(t.balance, item.price)) throw new TreasuryError(`Not enough gold — you need ${item.price - t.balance} more.`);
  try {
    await db.purchase.create({ data: { itemId, price: item.price } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") throw new TreasuryError("You already own that.");
    throw err;
  }
  await db.auditEvent.create({ data: { actor: "owner", action: "shop.buy", entityType: "Purchase", entityId: itemId, details: JSON.stringify({ price: item.price }) } });
}

/** Equip an owned item on a dragon (null = remove). */
export async function equipItem(db: PrismaClient, rawAreaId: string, rawItemId: string | null): Promise<void> {
  const areaId = areaIdSchema.parse(rawAreaId);
  const itemId = rawItemId ? itemIdSchema.parse(rawItemId) : null;
  if (itemId && !(await db.purchase.findUnique({ where: { itemId } }))) throw new TreasuryError("Buy it in the shop first.");
  await db.dragonProfile.upsert({ where: { areaId }, create: { areaId, accessory: itemId }, update: { accessory: itemId } });
}

// ── Favourite dragon ─────────────────────────────────────────────────────────

const FAVOURITE_KEY = "dragon.favourite";

export async function getFavouriteDragon(db: PrismaClient): Promise<string | null> {
  const row = await db.appSetting.findUnique({ where: { key: FAVOURITE_KEY } });
  const parsed = areaIdSchema.safeParse(row ? JSON.parse(row.value) : null);
  return parsed.success ? parsed.data : null;
}

export async function setFavouriteDragon(db: PrismaClient, rawAreaId: string): Promise<void> {
  const areaId = areaIdSchema.parse(rawAreaId);
  const value = JSON.stringify(areaId);
  await db.appSetting.upsert({ where: { key: FAVOURITE_KEY }, create: { key: FAVOURITE_KEY, value }, update: { value } });
}
