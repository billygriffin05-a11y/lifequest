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
import { deltasFor, londonDateKey, reversalOf, summarise, type HonourSummary } from "../rules";
import { actionInputSchema, type ActionInput, type ActionKind } from "../schemas";
import { STARTER_ACTIONS } from "../starter-actions";

type Db = PrismaClient;
const DEVICE = "pc";

export class HonourError extends Error {
  constructor(
    message: string,
    readonly code: "NOT_FOUND" | "ARCHIVED" | "ALREADY_REVERSED" | "NOT_REVERSIBLE" | "CONFLICT",
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

export async function logAction(db: Db, input: { actionId: string; idempotencyKey: string }, now = new Date()) {
  const existing = await db.pointEntry.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) return existing; // retry of a request that already succeeded

  const action = await db.pointAction.findFirst({ where: { id: input.actionId, deletedAt: null } });
  if (!action) throw new HonourError("Action not found", "NOT_FOUND");
  if (action.archivedAt) throw new HonourError("This action is archived", "ARCHIVED");

  const deltas = deltasFor(action.kind as ActionKind, action.points);
  try {
    return await db.$transaction(async (tx) => {
      const entry = await tx.pointEntry.create({
        data: {
          actionId: action.id,
          kind: action.kind,
          actionName: action.name,
          actionIcon: action.icon,
          ...deltas,
          occurredOn: londonDateKey(now),
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

export interface TodayEntry {
  id: string;
  name: string;
  icon: string;
  kind: string;
  honourDelta: number;
  occurredAt: Date;
  undone: boolean;
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
      undone: reversed.has(r.id),
    }));
}
