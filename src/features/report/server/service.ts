/**
 * Weekly report: read-only roll-up of one Monday–Sunday week across Honour,
 * money, body and mind. Everything is derived from the local database.
 */
import type { PrismaClient } from "@/generated/prisma/client";
import { getActivityDamageByWeek } from "@/features/honour/server/activity";
import { listLedger } from "@/features/honour/server/service";
import { summariseWeek, weekDays } from "../rules";

type Db = PrismaClient;

const WATER_GOAL = 8;

export async function getWeeklyReport(db: Db, weekStart: string) {
  const days = weekDays(weekStart);
  const from = days[0];
  const to = days[6];
  const inWeek = { gte: from, lte: to };

  const [ledger, activity, spend, sets, runs, water, sleeps, focus, reviews, pages, reflections] = await Promise.all([
    listLedger(db),
    getActivityDamageByWeek(db),
    db.transaction.aggregate({ where: { deletedAt: null, occurredOn: inWeek, amountPence: { gt: 0 } }, _sum: { amountPence: true } }),
    db.workoutSet.findMany({ where: { deletedAt: null, occurredOn: inWeek }, select: { occurredOn: true } }),
    db.runLog.findMany({ where: { deletedAt: null, occurredOn: inWeek }, select: { distanceMetres: true } }),
    db.waterDay.count({ where: { day: inWeek, glasses: { gte: WATER_GOAL } } }),
    db.sleepLog.findMany({ where: { day: inWeek }, select: { minutes: true } }),
    db.focusSession.aggregate({ where: { day: inWeek }, _sum: { minutes: true } }),
    db.cardReview.findMany({ where: { day: inWeek }, select: { correct: true } }),
    db.readingLog.aggregate({ where: { day: inWeek }, _sum: { pages: true } }),
    db.reflection.findMany({ where: { day: inWeek }, select: { mood: true, entry: true } }),
  ]);

  const moods = reflections.flatMap((r) => (r.mood ? [r.mood] : []));
  return {
    weekStart: from,
    weekEnd: to,
    honour: summariseWeek(ledger, from, activity.get(from)),
    money: { spentPence: spend._sum.amountPence ?? 0 },
    body: {
      workoutDays: new Set(sets.map((s) => s.occurredOn)).size,
      runs: runs.length,
      runMetres: runs.reduce((n, r) => n + r.distanceMetres, 0),
      waterGoalDays: water,
      sleepAvgMinutes: sleeps.length ? Math.round(sleeps.reduce((n, s) => n + s.minutes, 0) / sleeps.length) : null,
    },
    mind: {
      focusMinutes: focus._sum.minutes ?? 0,
      reviews: reviews.length,
      reviewsRight: reviews.filter((r) => r.correct).length,
      pages: pages._sum.pages ?? 0,
      moodAvg: moods.length ? Math.round((moods.reduce((n, m) => n + m, 0) / moods.length) * 10) / 10 : null,
      journalDays: reflections.filter((r) => r.entry).length,
    },
  };
}
