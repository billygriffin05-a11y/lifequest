/**
 * Body service: workouts, runs, water, sleep, weight. Health data stays in the
 * local database and is never logged. Deletes are soft for workouts and runs.
 */
import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { bodyXp, liftPbs, liftSuggestions, MAX_GLASSES, runPbs, SLEEP_GOAL_MINUTES, sleepMinutes, WATER_GOAL } from "../rules";

type Db = PrismaClient;
export class BodyError extends Error {}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const day = z.string().regex(DAY_RE, "Pick a date");
const audit = (db: Db, action: string, entityId?: string) =>
  db.auditEvent.create({ data: { actor: "owner", action, entityType: "Body", entityId } });

// ── Workouts ─────────────────────────────────────────────────────────────────

export const workoutInput = z
  .object({
    occurredOn: day,
    exercise: z.string().trim().min(1, "Name the exercise").max(40),
    sets: z.number().int().min(1, "At least 1 set").max(50),
    reps: z.number().int().min(1, "At least 1 rep").max(500),
    weightGrams: z.number().int().min(0).max(500_000),
  })
  .strict();

export async function addWorkoutSet(db: Db, input: z.input<typeof workoutInput>) {
  const row = await db.workoutSet.create({ data: workoutInput.parse(input) });
  await audit(db, "body.workout.add", row.id);
  return row;
}

export async function deleteWorkoutSet(db: Db, id: string) {
  await db.workoutSet.update({ where: { id }, data: { deletedAt: new Date() } });
  await audit(db, "body.workout.delete", id);
}

// ── Runs ─────────────────────────────────────────────────────────────────────

export const runInput = z
  .object({
    occurredOn: day,
    distanceMetres: z.number().int().min(1).max(300_000),
    durationSeconds: z.number().int().min(1).max(24 * 3600),
  })
  .strict();

export async function addRun(db: Db, input: z.input<typeof runInput>) {
  const row = await db.runLog.create({ data: runInput.parse(input) });
  await audit(db, "body.run.add", row.id);
  return row;
}

export async function deleteRun(db: Db, id: string) {
  await db.runLog.update({ where: { id }, data: { deletedAt: new Date() } });
  await audit(db, "body.run.delete", id);
}

// ── Water / sleep / weight (one row per day; saving again replaces) ──────────

export async function changeWater(db: Db, dayKey: string, delta: number): Promise<number> {
  day.parse(dayKey);
  if (!Number.isInteger(delta) || Math.abs(delta) > MAX_GLASSES) throw new BodyError("Bad amount.");
  const cur = (await db.waterDay.findUnique({ where: { day: dayKey } }))?.glasses ?? 0;
  const glasses = Math.max(0, Math.min(MAX_GLASSES, cur + delta));
  await db.waterDay.upsert({ where: { day: dayKey }, create: { day: dayKey, glasses }, update: { glasses } });
  return glasses;
}

export async function saveSleep(db: Db, dayKey: string, bedTime: string, wakeTime: string) {
  day.parse(dayKey);
  const minutes = sleepMinutes(bedTime, wakeTime);
  if (minutes === null) throw new BodyError("Enter bed and wake times like 23:00 and 07:00.");
  await db.sleepLog.upsert({ where: { day: dayKey }, create: { day: dayKey, bedTime, wakeTime, minutes }, update: { bedTime, wakeTime, minutes } });
  await audit(db, "body.sleep.save");
  return minutes;
}

export async function saveWeight(db: Db, dayKey: string, grams: number) {
  day.parse(dayKey);
  if (!Number.isInteger(grams) || grams < 20_000 || grams > 500_000) throw new BodyError("Enter a weight between 20 and 500 kg.");
  await db.weightLog.upsert({ where: { day: dayKey }, create: { day: dayKey, grams }, update: { grams } });
  await audit(db, "body.weight.save");
}

// ── Read models ──────────────────────────────────────────────────────────────

const shift = (dayKey: string, n: number) => {
  const d = new Date(`${dayKey}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export async function getBodyOverview(db: Db, today: string) {
  const since7 = shift(today, -6);
  const since90 = shift(today, -89);
  const [sets, runs, water, sleeps, weights] = await Promise.all([
    db.workoutSet.findMany({ where: { deletedAt: null }, orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }] }),
    db.runLog.findMany({ where: { deletedAt: null }, orderBy: [{ occurredOn: "desc" }, { createdAt: "desc" }] }),
    db.waterDay.findMany({ where: { day: { gte: since7, lte: today } }, orderBy: { day: "asc" } }),
    db.sleepLog.findMany({ where: { day: { gte: since7, lte: today } }, orderBy: { day: "desc" } }),
    db.weightLog.findMany({ where: { day: { gte: since90, lte: today } }, orderBy: { day: "asc" } }),
  ]);
  const sleepAvg = sleeps.length ? Math.round(sleeps.reduce((n, s) => n + s.minutes, 0) / sleeps.length) : null;
  return {
    today,
    recentSets: sets.slice(0, 20),
    pbs: liftPbs(sets),
    suggestions: liftSuggestions(sets).slice(0, 8),
    recentRuns: runs.slice(0, 10),
    runPbs: runPbs(runs),
    runTotalMetres: runs.reduce((n, r) => n + r.distanceMetres, 0),
    waterToday: water.find((w) => w.day === today)?.glasses ?? 0,
    waterWeekDaysAtGoal: water.filter((w) => w.glasses >= WATER_GOAL).length,
    sleeps,
    sleepAvg,
    weights: weights.map((w) => ({ day: w.day, grams: w.grams })),
  };
}

/** Derived bonus XP by dragon area, from every body log so far. */
export async function getBodyRewards(db: Db): Promise<Map<string, number>> {
  const [sets, runs, water, sleeps] = await Promise.all([
    db.workoutSet.findMany({ where: { deletedAt: null }, select: { occurredOn: true } }),
    db.runLog.findMany({ where: { deletedAt: null }, select: { occurredOn: true } }),
    db.waterDay.findMany({ where: { glasses: { gte: WATER_GOAL } }, select: { day: true } }),
    db.sleepLog.findMany({ where: { minutes: { gte: SLEEP_GOAL_MINUTES } }, select: { day: true } }),
  ]);
  return bodyXp({
    activeDays: [...sets, ...runs].map((r) => r.occurredOn),
    waterDays: water.map((w) => w.day),
    sleepNights: sleeps.map((s) => s.day),
  });
}
