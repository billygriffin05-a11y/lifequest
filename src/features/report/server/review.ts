/**
 * Weekly review: three short reflections per Monday–Sunday week, plus an
 * older journal entry resurfaced for perspective. Private; never logged.
 */
import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";

type Db = PrismaClient;

export const REVIEW_XP = 10;
export const MAX_REVIEW_TEXT = 300;

const text = z.string().trim().max(MAX_REVIEW_TEXT, `Keep each answer under ${MAX_REVIEW_TEXT} characters`);
export const reviewInput = z.object({ win: text, obstacle: text, change: text }).strict();

const WEEK_RE = /^\d{4}-\d{2}-\d{2}$/;

export function getReview(db: Db, weekStart: string) {
  return db.weeklyReview.findUnique({ where: { weekStart } });
}

export async function saveReview(db: Db, weekStart: string, input: z.input<typeof reviewInput>) {
  if (!WEEK_RE.test(weekStart)) throw new Error("Bad week");
  const data = reviewInput.parse(input);
  await db.weeklyReview.upsert({ where: { weekStart }, create: { weekStart, ...data }, update: data });
}

export const isComplete = (r: { win: string; obstacle: string; change: string } | null) => Boolean(r && (r.win || r.obstacle || r.change));

/** Weeks with a (non-empty) review — each is worth REVIEW_XP for the Habits dragon. */
export async function getReviewRewardWeeks(db: Db): Promise<number> {
  const rows = await db.weeklyReview.findMany({ select: { win: true, obstacle: true, change: true } });
  return rows.filter(isComplete).length;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** A journal entry from at least 30 days before this week (or the oldest one), chosen stably per week. */
export async function resurfacedEntry(db: Db, weekStart: string): Promise<{ day: string; entry: string } | null> {
  const cutoff = new Date(`${weekStart}T12:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - 30);
  const before = cutoff.toISOString().slice(0, 10);
  let rows = await db.reflection.findMany({ where: { entry: { not: null }, day: { lte: before } }, select: { day: true, entry: true }, orderBy: { day: "asc" } });
  if (!rows.length) {
    rows = await db.reflection.findMany({ where: { entry: { not: null }, day: { lt: weekStart } }, select: { day: true, entry: true }, orderBy: { day: "asc" }, take: 1 });
  }
  if (!rows.length) return null;
  const pick = rows[hash(weekStart) % rows.length];
  return { day: pick.day, entry: pick.entry ?? "" };
}
