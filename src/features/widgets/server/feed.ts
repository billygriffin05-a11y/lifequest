/**
 * Small read-only summary for phone widgets (Scriptable on iPhone).
 * Deliberately minimal: no money amounts, no health numbers beyond water
 * glasses, no journal text. Served only on allowed hosts (localhost/Tailscale).
 */
import type { PrismaClient } from "@/generated/prisma/client";
import { getBodyOverview } from "@/features/body/server/service";
import type { CalEvent } from "@/features/calendar/google/event-mapping";
import { getGoogleEvents } from "@/features/calendar/server/google-events";
import type { CalendarDeps } from "@/features/calendar/server/service";
import { getDragons } from "@/features/dragons/server/service";
import { occurrences } from "@/features/finance/recurring";
import { getRecurring } from "@/features/finance/server/service";
import { londonDateKey } from "@/features/honour/rules";
import { getPlayerProgress, getSummary } from "@/features/honour/server/service";
import { getCardStats } from "@/features/mind/server/service";
import { getFavouriteDragon } from "@/features/treasury/server/service";

export interface WidgetFeed {
  updated: string;
  rank: { title: string; level: number; xp: number; percent: number };
  honourToday: number;
  quests: { done: number; total: number };
  bestStreak: number;
  boss: { name: string; emoji: string; hpLeft: number; hp: number; defeated: boolean };
  cardsDue: number;
  water: { glasses: number; goal: number };
  dragon: { name: string; stage: string; mood: string } | null;
  /** Today's events, then the next few after today (title + day + time only). */
  events: { day: string; time: string | null; title: string }[];
}

function addDays(key: string, n: number) {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export async function getWidgetFeed(db: PrismaClient, deps: CalendarDeps, now = new Date()): Promise<WidgetFeed> {
  const today = londonDateKey(now);
  const until = addDays(today, 14);
  const [progress, summary, cards, body, dragons, favourite, google, bills] = await Promise.all([
    getPlayerProgress(db, now),
    getSummary(db, now),
    getCardStats(db, today),
    getBodyOverview(db, today),
    getDragons(db, now),
    getFavouriteDragon(db),
    getGoogleEvents(deps, today, until),
    getRecurring(db, today),
  ]);
  const fav = dragons.find((d) => d.area.id === favourite) ?? [...dragons].sort((a, b) => b.growth.xp - a.growth.xp)[0];
  const billEvents: CalEvent[] = bills.flatMap((b) =>
    occurrences(b, today, until).map((day) => ({ id: `bill:${b.payee}:${day}`, title: b.payee, calendar: "Bills", colour: null, day, allDay: true, start: null, end: null })),
  );
  const events = [...google.events, ...billEvents]
    .sort((a, b) => a.day.localeCompare(b.day) || Number(b.allDay) - Number(a.allDay) || (a.start ?? "").localeCompare(b.start ?? ""))
    .filter((e, i, all) => all.findIndex((x) => x.day === e.day && x.title === e.title) === i)
    .slice(0, 6)
    .map((e) => ({ day: e.day, time: e.allDay ? null : e.start, title: e.title.slice(0, 60) }));
  return {
    updated: now.toISOString(),
    rank: { title: progress.rank.title, level: progress.rank.level, xp: progress.totalXp, percent: progress.rank.percent },
    honourToday: summary.today.net,
    quests: { done: progress.quests.filter((q) => q.done).length, total: progress.quests.length },
    bestStreak: Math.max(0, ...Object.values(progress.streaks)),
    boss: { name: progress.boss.name, emoji: progress.boss.emoji, hpLeft: progress.boss.hpLeft, hp: progress.boss.hp, defeated: progress.boss.defeated },
    cardsDue: cards.due.length,
    water: { glasses: body.waterToday, goal: 8 },
    dragon: fav ? { name: fav.displayName, stage: fav.growth.stageName, mood: fav.mood } : null,
    events,
  };
}
