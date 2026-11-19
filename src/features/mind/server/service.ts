/**
 * Mind service: books, flashcards, reflections (mood + journal), focus sessions.
 * Journal text and mood are private: never logged or sent anywhere.
 */
import { z } from "zod";
import type { PrismaClient } from "@/generated/prisma/client";
import { addDays, averageMood, FOCUS_LENGTHS, MAX_FOCUS_MINUTES_PER_DAY, mindXp, nextReview, readingPercent } from "../rules";
import { STARTER_DECK } from "../starter-deck";

type Db = PrismaClient;
export class MindError extends Error {}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const day = z.string().regex(DAY_RE, "Pick a date");
const audit = (db: Db, action: string, entityId?: string) =>
  db.auditEvent.create({ data: { actor: "owner", action, entityType: "Mind", entityId } });

// ── Books ────────────────────────────────────────────────────────────────────

export const bookInput = z
  .object({
    title: z.string().trim().min(1, "Add a title").max(120),
    author: z.string().trim().max(80),
    totalPages: z.number().int().min(1, "Pages must be at least 1").max(10_000),
  })
  .strict();

export async function addBook(db: Db, input: z.input<typeof bookInput>) {
  const b = await db.book.create({ data: bookInput.parse(input) });
  await audit(db, "mind.book.add", b.id);
  return b;
}

export async function archiveBook(db: Db, id: string) {
  await db.book.update({ where: { id }, data: { archivedAt: new Date() } });
}

/** Log pages read; marks the book finished the first time it reaches the end. */
export async function logPages(db: Db, bookId: string, pages: number, dayKey: string) {
  day.parse(dayKey);
  if (!Number.isInteger(pages) || pages < 1 || pages > 2000) throw new MindError("Enter pages read (1–2000).");
  const book = await db.book.findUnique({ where: { id: bookId }, include: { logs: true } });
  if (!book || book.archivedAt) throw new MindError("Unknown book.");
  const read = book.logs.reduce((n, l) => n + l.pages, 0);
  if (read >= book.totalPages) throw new MindError("You've already finished this book.");
  const add = Math.min(pages, book.totalPages - read);
  await db.readingLog.create({ data: { bookId, pages: add, day: dayKey } });
  const finished = read + add >= book.totalPages;
  if (finished) await db.book.update({ where: { id: bookId }, data: { finishedOn: dayKey } });
  await audit(db, "mind.book.pages", bookId);
  return { finished };
}

export async function listBooks(db: Db) {
  const books = await db.book.findMany({ where: { archivedAt: null }, include: { logs: true }, orderBy: { createdAt: "desc" } });
  return books.map((b) => {
    const pagesRead = b.logs.reduce((n, l) => n + l.pages, 0);
    return {
      id: b.id,
      title: b.title,
      author: b.author,
      totalPages: b.totalPages,
      pagesRead,
      percent: readingPercent(pagesRead, b.totalPages),
      finishedOn: b.finishedOn,
    };
  });
}

// ── Flashcards ───────────────────────────────────────────────────────────────

export async function seedStarterDeck(db: Db, today: string): Promise<number> {
  let added = 0;
  for (const c of STARTER_DECK) {
    const exists = await db.flashcard.findUnique({ where: { seedKey: c.key } });
    if (exists) continue;
    await db.flashcard.create({ data: { seedKey: c.key, topic: c.topic, front: c.front, back: c.back, dueOn: today } });
    added++;
  }
  if (added) await audit(db, "mind.cards.seed");
  return added;
}

export const cardInput = z
  .object({
    front: z.string().trim().min(1, "Add a question").max(300),
    back: z.string().trim().min(1, "Add an answer").max(600),
    topic: z.string().trim().max(60),
  })
  .strict();

export async function addCard(db: Db, input: z.input<typeof cardInput>, today: string) {
  const c = await db.flashcard.create({ data: { ...cardInput.parse(input), dueOn: today } });
  await audit(db, "mind.card.add", c.id);
  return c;
}

export async function archiveCard(db: Db, id: string) {
  await db.flashcard.update({ where: { id }, data: { archivedAt: new Date() } });
}

export async function reviewCard(db: Db, id: string, correct: boolean, today: string) {
  day.parse(today);
  const card = await db.flashcard.findUnique({ where: { id } });
  if (!card || card.archivedAt) throw new MindError("Unknown card.");
  if (card.dueOn > today) throw new MindError("That card isn't due yet.");
  const next = nextReview(card.box, correct, today);
  await db.$transaction([
    db.flashcard.update({ where: { id }, data: next }),
    db.cardReview.create({ data: { cardId: id, day: today, correct } }),
  ]);
  return next;
}

export async function getCardStats(db: Db, today: string) {
  const [cards, due, reviewedToday, correctToday] = await Promise.all([
    db.flashcard.groupBy({ by: ["box"], where: { archivedAt: null }, _count: true }),
    db.flashcard.findMany({ where: { archivedAt: null, dueOn: { lte: today } }, orderBy: [{ dueOn: "asc" }, { box: "asc" }, { createdAt: "asc" }] }),
    db.cardReview.count({ where: { day: today } }),
    db.cardReview.count({ where: { day: today, correct: true } }),
  ]);
  const byBox = [1, 2, 3, 4, 5].map((b) => cards.find((c) => c.box === b)?._count ?? 0);
  return { byBox, total: byBox.reduce((n, c) => n + c, 0), due, reviewedToday, correctToday };
}

export function listCards(db: Db) {
  return db.flashcard.findMany({ where: { archivedAt: null }, orderBy: [{ topic: "asc" }, { createdAt: "asc" }] });
}

// ── Reflection (mood + journal) ──────────────────────────────────────────────

export const MAX_ENTRY = 1000;

export async function saveReflection(db: Db, dayKey: string, mood: number | null, entry: string) {
  day.parse(dayKey);
  if (mood !== null && (!Number.isInteger(mood) || mood < 1 || mood > 5)) throw new MindError("Pick a mood from 1 to 5.");
  const text = entry.trim();
  if (text.length > MAX_ENTRY) throw new MindError(`Keep it under ${MAX_ENTRY} characters.`);
  const data = { mood, entry: text || null };
  await db.reflection.upsert({ where: { day: dayKey }, create: { day: dayKey, ...data }, update: data });
}

export async function getReflections(db: Db, today: string, days = 14) {
  const since = addDays(today, -(days - 1));
  const rows = await db.reflection.findMany({ where: { day: { gte: since, lte: today } }, orderBy: { day: "asc" } });
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const series = Array.from({ length: days }, (_, i) => {
    const d = addDays(since, i);
    return { day: d, mood: byDay.get(d)?.mood ?? null };
  });
  const moods = rows.flatMap((r) => (r.mood ? [r.mood] : []));
  return {
    today: byDay.get(today) ?? null,
    series,
    average: averageMood(moods),
    entries: rows.filter((r) => r.entry).reverse(),
  };
}

// ── Focus ────────────────────────────────────────────────────────────────────

export async function logFocus(db: Db, dayKey: string, minutes: number, label: string) {
  day.parse(dayKey);
  if (!(FOCUS_LENGTHS as readonly number[]).includes(minutes)) throw new MindError("Unknown session length.");
  const used = (await db.focusSession.aggregate({ where: { day: dayKey }, _sum: { minutes: true } }))._sum.minutes ?? 0;
  if (used + minutes > MAX_FOCUS_MINUTES_PER_DAY) throw new MindError("That's over 12 hours of focus today — take a break!");
  await db.focusSession.create({ data: { day: dayKey, minutes, label: label.trim().slice(0, 60) } });
  await audit(db, "mind.focus.log");
}

export async function getFocusStats(db: Db, today: string) {
  const since = addDays(today, -6);
  const rows = await db.focusSession.findMany({ where: { day: { gte: since, lte: today } }, orderBy: { createdAt: "desc" } });
  return {
    todayMinutes: rows.filter((r) => r.day === today).reduce((n, r) => n + r.minutes, 0),
    weekMinutes: rows.reduce((n, r) => n + r.minutes, 0),
    recent: rows.slice(0, 8),
  };
}

// ── Rewards (derived) ────────────────────────────────────────────────────────

export async function getMindRewards(db: Db): Promise<Map<string, number>> {
  const [reading, finished, reviews, focus, journal] = await Promise.all([
    db.readingLog.findMany({ select: { day: true } }),
    db.book.count({ where: { finishedOn: { not: null } } }),
    db.cardReview.findMany({ select: { day: true } }),
    db.focusSession.findMany({ select: { day: true, minutes: true } }),
    db.reflection.findMany({ where: { entry: { not: null } }, select: { day: true } }),
  ]);
  return mindXp({
    readingDays: reading.map((r) => r.day),
    booksFinished: finished,
    reviewDays: reviews.map((r) => r.day),
    focus,
    journalDays: journal.map((j) => j.day),
  });
}
