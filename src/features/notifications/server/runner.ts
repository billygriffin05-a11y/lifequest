/**
 * Collect today's facts and send any reminders that are due. Runs every
 * minute from server startup; does nothing until a device has subscribed.
 */
import type { PrismaClient } from "@/generated/prisma/client";
import type { DataPaths } from "@/server/config/paths";
import { getMonthOverview } from "@/features/finance/server/service";
import { londonDateKey } from "@/features/honour/rules";
import { getLoggedTodayActionIds, getPlayerProgress, listActions } from "@/features/honour/server/service";
import { getCardStats } from "@/features/mind/server/service";
import { dueReminders, type ReminderFacts } from "../rules";
import { claim, countSubscriptions, getOrCreateVapidKeys, getPrefs, sendToAll, type Sender } from "./service";

const londonTime = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hour12: false });

export async function collectFacts(db: PrismaClient, now: Date): Promise<ReminderFacts> {
  const today = londonDateKey(now);
  const month = today.slice(0, 7);
  const [progress, actions, doneToday, cards, money] = await Promise.all([
    getPlayerProgress(db, now),
    listActions(db),
    getLoggedTodayActionIds(db, now),
    getCardStats(db, today),
    getMonthOverview(db, month),
  ]);
  const good = actions.filter((a) => a.kind === "good");
  return {
    today,
    month,
    nowTime: londonTime.format(now),
    streaksAtRisk: good.filter((a) => (progress.streaks[a.id] ?? 0) >= 2 && !doneToday.has(a.id)).length,
    cardsDue: cards.due.length,
    budgetsNearLimit: money.categories.filter((c) => !c.archived && c.limit > 0 && (c.state === "warn" || c.state === "over")).map((c) => c.id),
    plans: actions
      .filter((a) => a.cue && a.cueTime && !doneToday.has(a.id))
      .map((a) => ({ actionId: a.id, name: a.name, icon: a.icon, cue: a.cue!, time: a.cueTime! })),
  };
}

export async function runReminders(db: PrismaClient, paths: DataPaths, now = new Date(), send?: Sender) {
  if ((await countSubscriptions(db)) === 0) return { sent: 0 };
  const prefs = await getPrefs(db);
  const due = dueReminders(prefs, await collectFacts(db, now));
  if (!due.length) return { sent: 0 };
  const vapid = getOrCreateVapidKeys(paths);
  let sent = 0;
  for (const r of due) {
    if (!(await claim(db, r.key))) continue;
    sent += (await sendToAll(db, vapid, r, send)).sent;
  }
  return { sent };
}
