/**
 * In-app calendar data: what happened on each day of a month, and the full
 * detail for one day. Read-only, local database only.
 */
import type { PrismaClient } from "@/generated/prisma/client";
import { listLedger } from "@/features/honour/server/service";
import { emptyDay, type DayActivity } from "../month";

type Db = PrismaClient;

/** Activity per day key between `from` and `to` (inclusive). */
export async function getActivityByDay(db: Db, from: string, to: string): Promise<Map<string, DayActivity>> {
  const range = { gte: from, lte: to };
  const [ledger, sets, runs, reading, focus, spend, reflections] = await Promise.all([
    listLedger(db),
    db.workoutSet.findMany({ where: { deletedAt: null, occurredOn: range }, select: { occurredOn: true } }),
    db.runLog.findMany({ where: { deletedAt: null, occurredOn: range }, select: { occurredOn: true } }),
    db.readingLog.findMany({ where: { day: range }, select: { day: true } }),
    db.focusSession.findMany({ where: { day: range }, select: { day: true, minutes: true } }),
    db.transaction.findMany({ where: { deletedAt: null, occurredOn: range, amountPence: { gt: 0 } }, select: { occurredOn: true, amountPence: true } }),
    db.reflection.findMany({ where: { day: range }, select: { day: true, mood: true, entry: true } }),
  ]);
  const out = new Map<string, DayActivity>();
  const at = (k: string) => {
    let a = out.get(k);
    if (!a) out.set(k, (a = emptyDay()));
    return a;
  };
  for (const e of ledger) {
    if (e.occurredOn < from || e.occurredOn > to || e.undone || e.isReversal) continue;
    const a = at(e.occurredOn);
    if (e.kind === "good") a.good++;
    else a.bad++;
    a.net += e.honourDelta;
  }
  for (const s of [...sets, ...runs]) at(s.occurredOn).active = true;
  for (const r of reading) at(r.day).reading = true;
  for (const f of focus) at(f.day).focusMinutes += f.minutes;
  for (const t of spend) at(t.occurredOn).spentPence += t.amountPence;
  for (const r of reflections) {
    const a = at(r.day);
    a.mood = r.mood;
    a.journal = !!r.entry;
  }
  return out;
}

/** Everything logged on one day, for the detail panel. */
export async function getDayDetail(db: Db, day: string) {
  const [ledger, sets, runs, water, sleep, weight, reading, focus, money, reflection, reviews] = await Promise.all([
    listLedger(db),
    db.workoutSet.findMany({ where: { deletedAt: null, occurredOn: day }, orderBy: { createdAt: "asc" } }),
    db.runLog.findMany({ where: { deletedAt: null, occurredOn: day } }),
    db.waterDay.findUnique({ where: { day } }),
    db.sleepLog.findUnique({ where: { day } }),
    db.weightLog.findUnique({ where: { day } }),
    db.readingLog.findMany({ where: { day }, include: { book: { select: { title: true } } } }),
    db.focusSession.findMany({ where: { day }, orderBy: { createdAt: "asc" } }),
    db.transaction.findMany({ where: { deletedAt: null, occurredOn: day }, orderBy: { createdAt: "asc" } }),
    db.reflection.findUnique({ where: { day } }),
    db.cardReview.count({ where: { day } }),
  ]);
  return {
    day,
    deeds: ledger.filter((e) => e.occurredOn === day && !e.undone && !e.isReversal),
    sets,
    runs,
    water: water?.glasses ?? 0,
    sleep,
    weight,
    reading,
    focus,
    money,
    reflection,
    reviews,
  };
}
