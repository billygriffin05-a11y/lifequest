/**
 * Honour domain service. Takes the Prisma client as a parameter so it can be
 * integration-tested against a throwaway database.
 *
 * Integrity rules:
 *  - PointEntry is append-only. Undo writes a reversal entry; nothing is updated or deleted.
 *  - Every write carries an idempotency key, so retries never double-count.
 *  - Points/XP are computed here on the server from the stored action, never taken from the client.
 *  - Every ledger write records an AuditEvent (ids only, no free text).
 */
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import {
  buildDailySeries,
  deltasFor,
  lastNDateKeys,
  londonDateKey,
  reversalOf,
  summarise,
  type DailyPoint,
  type HonourSummary,
} from "../rules";
import { rankForXp, streaksByAction, type Rank } from "../progress";
import { actionInputSchema, type ActionInput, type ActionKind } from "../schemas";
import { STARTER_ACTIONS } from "../starter-actions";

type Db = PrismaClient;
const DEVICE = "pc";

export class HonourError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "ARCHIVED" | "ALREADY_REVERSED" | "NOT_REVERSIBLE" | "CONFLICT" | "ALREADY_LOGGED_TODAY",
  ) {
    super(message);
  }
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

// ── Actions (definitions) ────────────────────────────────────────────────────

export function listActions(db: Db, opts: { includeArchived?: boolean } = {}) {
  return db.pointAction.findMany({
    where: { deletedAt: null, ...(opts.includeArchived ? {} : { archivedAt: null }) },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export async function createAction(db: Db, input: ActionInput) {
  const data = actionInputSchema.parse(input);
  const count = await db.pointAction.count();
  const action = await db.pointAction.create({ data: { ...data, sortOrder: count, updatedByDevice: DEVICE } });
  await db.auditEvent.create({
    data: { actor: DEVICE, action: "honour.action.create", entityType: "PointAction", entityId: action.id },
  });
  return action;
}

export async function updateAction(db: Db, id: string, input: ActionInput) {
  const data = actionInputSchema.parse(input);
  const existing = await db.pointAction.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new HonourError("Action not found", "NOT_FOUND");
  // Past entries keep their snapshot values; only future logs use the new values.
  const updated = await db.pointAction.update({
    where: { id },
    data: { ...data, version: { increment: 1 }, updatedByDevice: DEVICE },
  });
  await db.auditEvent.create({
    data: { actor: DEVICE, action: "honour.action.update", entityType: "PointAction", entityId: id },
  });
  return updated;
}

export async function setArchived(db: Db, id: string, archived: boolean, now = new Date()) {
  const existing = await db.pointAction.findFirst({ where: { id, deletedAt: null } });
  if (!existing) throw new HonourError("Action not found", "NOT_FOUND");
  const updated = await db.pointAction.update({
    where: { id },
    data: { archivedAt: archived ? now : null, version: { increment: 1 }, updatedByDevice: DEVICE },
  });
  await db.auditEvent.create({
    data: {
      actor: DEVICE,
      action: archived ? "honour.action.archive" : "honour.action.restore",
      entityType: "PointAction",
      entityId: id,
    },
  });
  return updated;
}

/** Adds the starter examples, but only when the user has no actions yet. */
export async function addStarterActions(db: Db): Promise<number> {
  if ((await db.pointAction.count()) > 0) return 0;
  for (const a of STARTER_ACTIONS) await createAction(db, a);
  return STARTER_ACTIONS.length;
}

// ── Ledger ───────────────────────────────────────────────────────────────────

type Tx = Prisma.TransactionClient | Db;

/** True if the action has an entry on `day` that hasn't been undone. */
async function isLoggedOnDay(tx: Tx, actionId: string, day: string): Promise<boolean> {
  const originals = await tx.pointEntry.findMany({
    where: { actionId, occurredOn: day, reversesEntryId: null },
    select: { id: true },
  });
  if (originals.length === 0) return false;
  const undone = await tx.pointEntry.count({ where: { reversesEntryId: { in: originals.map((o) => o.id) } } });
  return undone < originals.length;
}

/** Action ids already logged (and not undone) today — used to show "Done today". */
export async function getLoggedTodayActionIds(db: Db, now = new Date()): Promise<Set<string>> {
  const day = londonDateKey(now);
  const rows = await db.pointEntry.findMany({ where: { occurredOn: day }, select: { id: true, actionId: true, reversesEntryId: true } });
  const undone = new Set(rows.flatMap((r) => (r.reversesEntryId ? [r.reversesEntryId] : [])));
  return new Set(rows.filter((r) => !r.reversesEntryId && !undone.has(r.id)).map((r) => r.actionId));
}

export async function logAction(db: Db, input: { actionId: string; idempotencyKey: string }, now = new Date()) {
  const existing = await db.pointEntry.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) return existing; // retry of a request that already succeeded

  const action = await db.pointAction.findFirst({ where: { id: input.actionId, deletedAt: null } });
  if (!action) throw new HonourError("Action not found", "NOT_FOUND");
  if (action.archivedAt) throw new HonourError("This action is archived", "ARCHIVED");

  const deltas = deltasFor(action.kind as ActionKind, action.points);
  const day = londonDateKey(now);
  try {
    return await db.$transaction(async (tx) => {
      // One per day: an action counts at most once per calendar day (an undo frees it again).
      if (await isLoggedOnDay(tx, action.id, day)) {
        throw new HonourError("Already logged today — come back tomorrow (or undo today's entry).", "ALREADY_LOGGED_TODAY");
      }
      const entry = await tx.pointEntry.create({
        data: {
          actionId: action.id,
          kind: action.kind,
          actionName: action.name,
          actionIcon: action.icon,
          actionCategory: action.category,
          ...deltas,
          occurredOn: day,
          occurredAt: now,
          idempotencyKey: input.idempotencyKey,
          updatedByDevice: DEVICE,
        },
      });
      await tx.auditEvent.create({
        data: {
          actor: DEVICE,
          action: "honour.log",
          entityType: "PointEntry",
          entityId: entry.id,
          idempotencyKey: `honour.log:${input.idempotencyKey}`,
        },
      });
      return entry;
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      const raced = await db.pointEntry.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (raced) return raced;
    }
    throw err;
  }
}

export async function undoEntry(db: Db, input: { entryId: string; idempotencyKey: string }, now = new Date()) {
  const existing = await db.pointEntry.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) return existing;

  const original = await db.pointEntry.findUnique({ where: { id: input.entryId } });
  if (!original) throw new HonourError("Entry not found", "NOT_FOUND");
  if (original.reversesEntryId) throw new HonourError("A reversal cannot be undone", "NOT_REVERSIBLE");

  try {
    return await db.$transaction(async (tx) => {
      const reversal = await tx.pointEntry.create({
        data: {
          actionId: original.actionId,
          kind: original.kind,
          actionName: original.actionName,
          actionIcon: original.actionIcon,
          actionCategory: original.actionCategory,
          ...reversalOf(original),
          // Counted against the same day as the entry it cancels.
          occurredOn: original.occurredOn,
          occurredAt: now,
          idempotencyKey: input.idempotencyKey,
          reversesEntryId: original.id,
          updatedByDevice: DEVICE,
        },
      });
      await tx.auditEvent.create({
        data: {
          actor: DEVICE,
          action: "honour.undo",
          entityType: "PointEntry",
          entityId: original.id,
          idempotencyKey: `honour.undo:${input.idempotencyKey}`,
        },
      });
      return reversal;
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      const retried = await db.pointEntry.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (retried) return retried;
      throw new HonourError("This entry has already been undone", "ALREADY_REVERSED");
    }
    throw err;
  }
}

// ── Read models ──────────────────────────────────────────────────────────────

export async function getSummary(db: Db, now = new Date()): Promise<HonourSummary> {
  const rows = await db.pointEntry.findMany({
    select: { kind: true, occurredOn: true, honourDelta: true, xpDelta: true },
  });
  return summarise(rows, londonDateKey(now));
}

export const TREND_RANGES = [7, 30, 90] as const;
export type TrendRange = (typeof TREND_RANGES)[number];

/** Daily good and bad points for the last `days` days (Europe/London), oldest first. */
export async function getDailyTrend(db: Db, days: TrendRange, now = new Date()): Promise<DailyPoint[]> {
  const keys = lastNDateKeys(londonDateKey(now), days);
  const rows = await db.pointEntry.groupBy({
    by: ["occurredOn", "kind"],
    where: { occurredOn: { gte: keys[0], lte: keys[keys.length - 1] } },
    _sum: { honourDelta: true },
  });
  return buildDailySeries(
    rows.map((r) => ({ occurredOn: r.occurredOn, kind: r.kind, honourDelta: r._sum.honourDelta ?? 0 })),
    keys,
  );
}

export interface CategoryTotals {
  category: string;
  /** All-time XP from this category (reversals included). */
  xp: number;
  /** Net Honour since `sinceDateKey` (inclusive). */
  recentHonour: number;
  /** Ledger rows since `sinceDateKey` (originals + reversals). */
  recentEntries: number;
}

/** Per-category XP and recent Honour — the public read model other features (dragons) use. */
export async function getCategoryTotals(db: Db, sinceDateKey: string): Promise<CategoryTotals[]> {
  const [allTime, recent] = await Promise.all([
    db.pointEntry.groupBy({ by: ["actionCategory"], _sum: { xpDelta: true } }),
    db.pointEntry.groupBy({
      by: ["actionCategory"],
      where: { occurredOn: { gte: sinceDateKey } },
      _sum: { honourDelta: true },
      _count: { _all: true },
    }),
  ]);
  const byCat = new Map<string, CategoryTotals>();
  for (const r of allTime) {
    byCat.set(r.actionCategory, { category: r.actionCategory, xp: r._sum.xpDelta ?? 0, recentHonour: 0, recentEntries: 0 });
  }
  for (const r of recent) {
    const row = byCat.get(r.actionCategory) ?? { category: r.actionCategory, xp: 0, recentHonour: 0, recentEntries: 0 };
    row.recentHonour = r._sum.honourDelta ?? 0;
    row.recentEntries = r._count._all;
    byCat.set(r.actionCategory, row);
  }
  return [...byCat.values()];
}

// ── Notes ────────────────────────────────────────────────────────────────────

/** Set or clear the owner's note on a logged deed (not on undo rows). Scoring is unaffected. */
export async function setEntryNote(db: Db, entryId: string, note: string | null) {
  const entry = await db.pointEntry.findUnique({ where: { id: entryId } });
  if (!entry) throw new HonourError("Entry not found", "NOT_FOUND");
  if (entry.reversesEntryId) throw new HonourError("Notes can't be added to an undo", "NOT_REVERSIBLE");
  const updated = await db.pointEntry.update({ where: { id: entryId }, data: { note } });
  await db.auditEvent.create({ data: { actor: DEVICE, action: "honour.note", entityType: "PointEntry", entityId: entryId } });
  return updated;
}

// ── Streaks, bonus XP and rank (all derived from the ledger) ─────────────────

async function ledgerFacts(db: Db) {
  return db.pointEntry.findMany({
    select: { id: true, actionId: true, actionCategory: true, kind: true, occurredOn: true, reversesEntryId: true, xpDelta: true },
  });
}

export interface PlayerProgress {
  baseXp: number;
  bonusXp: number;
  totalXp: number;
  rank: Rank;
  /** Current streak (days) per action id. */
  streaks: Record<string, number>;
}

export async function getPlayerProgress(db: Db, now = new Date()): Promise<PlayerProgress> {
  const rows = await ledgerFacts(db);
  const baseXp = rows.reduce((n, r) => n + r.xpDelta, 0);
  const streakMap = streaksByAction(rows, londonDateKey(now));
  let bonusXp = 0;
  const streaks: Record<string, number> = {};
  for (const [actionId, s] of streakMap) {
    bonusXp += s.bonusXp;
    streaks[actionId] = s.current;
  }
  return { baseXp, bonusXp, totalXp: baseXp + bonusXp, rank: rankForXp(baseXp + bonusXp), streaks };
}

/** Streak bonus XP per action category (feeds each area's dragon). */
export async function getStreakBonusByCategory(db: Db, now = new Date()): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (const s of streaksByAction(await ledgerFacts(db), londonDateKey(now)).values()) {
    out.set(s.category, (out.get(s.category) ?? 0) + s.bonusXp);
  }
  return out;
}

export interface TodayEntry {
  id: string;
  name: string;
  icon: string;
  kind: string;
  honourDelta: number;
  occurredAt: Date;
  undone: boolean;
  note: string | null;
}

/** Today's original entries (not reversal rows), newest first, flagged if undone. */
export async function getTodayEntries(db: Db, now = new Date()): Promise<TodayEntry[]> {
  const rows = await db.pointEntry.findMany({
    where: { occurredOn: londonDateKey(now) },
    orderBy: { occurredAt: "desc" },
  });
  const reversed = new Set(rows.flatMap((r) => (r.reversesEntryId ? [r.reversesEntryId] : [])));
  return rows
    .filter((r) => !r.reversesEntryId)
    .map((r) => ({
      id: r.id,
      name: r.actionName,
      icon: r.actionIcon,
      kind: r.kind,
      honourDelta: r.honourDelta,
      occurredAt: r.occurredAt,
      note: r.note,
      undone: reversed.has(r.id),
    }));
}
