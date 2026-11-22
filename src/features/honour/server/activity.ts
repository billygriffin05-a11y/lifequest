/** Body + mind activity facts that power the weekly boss (read-only). */
import type { PrismaClient } from "@/generated/prisma/client";
import { activityDamageByWeek, type ActivityDamage } from "../progress";

const WATER_GOAL = 8;
const SLEEP_GOAL_MINUTES = 7 * 60;

export async function getActivityDamageByWeek(db: PrismaClient): Promise<Map<string, ActivityDamage>> {
  const [sets, runs, water, sleeps, focus, reviews] = await Promise.all([
    db.workoutSet.findMany({ where: { deletedAt: null }, select: { occurredOn: true } }),
    db.runLog.findMany({ where: { deletedAt: null }, select: { occurredOn: true } }),
    db.waterDay.findMany({ where: { glasses: { gte: WATER_GOAL } }, select: { day: true } }),
    db.sleepLog.findMany({ where: { minutes: { gte: SLEEP_GOAL_MINUTES } }, select: { day: true } }),
    db.focusSession.findMany({ select: { day: true, minutes: true } }),
    db.cardReview.findMany({ select: { day: true } }),
  ]);
  return activityDamageByWeek({
    workoutDays: sets.map((s) => s.occurredOn),
    runs: runs.map((r) => r.occurredOn),
    waterDays: water.map((w) => w.day),
    sleepNights: sleeps.map((s) => s.day),
    focus,
    reviewDays: reviews.map((r) => r.day),
  });
}
