/**
 * Which reminders are due right now (pure). Each has a stable `key` so it is
 * sent at most once (PushLog). Payloads never contain amounts or health data.
 * Tests: tests/unit/notifications.test.ts
 */
import { z } from "zod";

const TIME = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const prefsSchema = z
  .object({
    streak: z.boolean(),
    streakTime: TIME,
    cards: z.boolean(),
    cardsTime: TIME,
    budget: z.boolean(),
    plans: z.boolean(),
    /** Sunday evening nudge to do the weekly review. */
    review: z.boolean().default(true),
  })
  .strict();
export type PushPrefs = z.infer<typeof prefsSchema>;

export const DEFAULT_PREFS: PushPrefs = {
  streak: true,
  streakTime: "20:00",
  cards: true,
  cardsTime: "09:00",
  budget: true,
  plans: true,
  review: true,
};

export const REVIEW_TIME = "18:00";

/** A reminder that's late by more than this is skipped (PC was off) rather than sent hours later. */
export const LATE_WINDOW_MIN = 180;

export interface ReminderFacts {
  today: string; // YYYY-MM-DD (Europe/London)
  nowTime: string; // HH:MM (Europe/London)
  month: string; // YYYY-MM
  /** Good actions with a live streak (2+) not yet done today. */
  streaksAtRisk: number;
  cardsDue: number;
  /** Budget category ids at or over 80% this month. */
  budgetsNearLimit: string[];
  /** If-then plans with a time, not done today. */
  plans: { actionId: string; name: string; icon: string; cue: string; time: string }[];
  /** Monday of this week, whether today is Sunday, and whether this week's review is done. */
  weekStart?: string;
  isSunday?: boolean;
  reviewDone?: boolean;
}

export interface Reminder {
  key: string;
  title: string;
  body: string;
  url: string;
}

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** True when `time` has passed today but not by more than the late window. */
export function inWindow(nowTime: string, time: string): boolean {
  const d = toMin(nowTime) - toMin(time);
  return d >= 0 && d <= LATE_WINDOW_MIN;
}

export function dueReminders(prefs: PushPrefs, f: ReminderFacts): Reminder[] {
  const out: Reminder[] = [];
  if (prefs.plans) {
    for (const p of f.plans) {
      if (!inWindow(f.nowTime, p.time)) continue;
      out.push({ key: `plan:${f.today}:${p.actionId}`, title: `${p.icon} ${p.cue}`, body: `Time for: ${p.name}`, url: "/honour" });
    }
  }
  if (prefs.cards && f.cardsDue > 0 && inWindow(f.nowTime, prefs.cardsTime)) {
    out.push({
      key: `cards:${f.today}`,
      title: "🃏 Security+ cards are ready",
      body: `${f.cardsDue} card${f.cardsDue === 1 ? "" : "s"} due today.`,
      url: "/mind/cards",
    });
  }
  if (prefs.streak && f.streaksAtRisk > 0 && inWindow(f.nowTime, prefs.streakTime)) {
    out.push({
      key: `streak:${f.today}`,
      title: "🔥 Keep your streak alive",
      body: f.streaksAtRisk === 1 ? "One streak ends at midnight unless you log it." : `${f.streaksAtRisk} streaks end at midnight unless you log them.`,
      url: "/honour",
    });
  }
  if (prefs.review && f.isSunday && !f.reviewDone && f.weekStart && inWindow(f.nowTime, REVIEW_TIME)) {
    out.push({ key: `review:${f.weekStart}`, title: "📜 Weekly review", body: "Three quick questions to close out your week.", url: "/report#review" });
  }
  if (prefs.budget) {
    // Once per category per month; no amounts in the message.
    for (const id of f.budgetsNearLimit) {
      out.push({ key: `budget:${f.month}:${id}`, title: "💷 A budget is nearly used up", body: "Open Money to see which one.", url: "/money" });
    }
  }
  return out;
}
