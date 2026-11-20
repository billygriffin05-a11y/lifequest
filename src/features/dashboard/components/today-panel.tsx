import Link from "next/link";
import { connection } from "next/server";
import { getBodyOverview } from "@/features/body/server/service";
import { getDailyReminder } from "@/features/calendar/server/service";
import { londonDateKey } from "@/features/honour/rules";
import { getPlayerProgress, listActions } from "@/features/honour/server/service";
import { getCardStats, getFocusStats } from "@/features/mind/server/service";
import { prisma } from "@/server/db/client";

const tile = "rounded-xl border border-obsidian-700 bg-obsidian-950/60 p-4 text-left";
const h2 = "font-display text-lg text-gold-300";

/** Home dashboard: what matters today, read at request time. */
export async function TodayPanel() {
  await connection();
  const today = londonDateKey(new Date());
  const [progress, actions, body, cards, focus, reminder] = await Promise.all([
    getPlayerProgress(prisma),
    listActions(prisma),
    getBodyOverview(prisma, today),
    getCardStats(prisma, today),
    getFocusStats(prisma, today),
    getDailyReminder(prisma),
  ]);
  const streaks = actions
    .filter((a) => a.kind === "good" && (progress.streaks[a.id] ?? 0) > 0)
    .map((a) => ({ id: a.id, name: a.name, icon: a.icon, days: progress.streaks[a.id] }))
    .sort((a, b) => b.days - a.days)
    .slice(0, 3);
  const questsDone = progress.quests.filter((q) => q.done).length;

  return (
    <div className="mt-6 grid gap-3 sm:grid-cols-2" data-testid="today-panel">
      <section aria-labelledby="quests-today" className={`${tile} sm:col-span-2`}>
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="quests-today" className={h2}>
            Today&apos;s quests
          </h2>
          <span className="text-sm text-silver-300">
            {questsDone} / {progress.quests.length} done
          </span>
        </div>
        {progress.quests.length === 0 ? (
          <p className="mt-2 text-sm text-silver-300">Add good actions on the Honour page to get daily quests.</p>
        ) : (
          <ul className="mt-2 grid gap-1 text-sm">
            {progress.quests.map((q) => (
              <li key={q.actionId} className={q.done ? "text-emerald-300" : "text-silver-100"}>
                {q.done ? "✅" : "⬜"} {q.icon} {q.name}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-silver-300">
          Boss: {progress.boss.emoji} {progress.boss.name} · {progress.boss.defeated ? "defeated!" : `${progress.boss.hpLeft} HP left`}
        </p>
      </section>

      <section aria-labelledby="streaks-today" className={tile}>
        <h2 id="streaks-today" className={h2}>
          Streaks
        </h2>
        {streaks.length === 0 ? (
          <p className="mt-2 text-sm text-silver-300">No streaks yet — today is day one.</p>
        ) : (
          <ul className="mt-2 grid gap-1 text-sm">
            {streaks.map((s) => (
              <li key={s.id} className="flex justify-between gap-2 text-silver-100">
                <span>
                  {s.icon} {s.name}
                </span>
                <span className="text-gold-300">🔥 {s.days}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="vitals-today" className={tile}>
        <h2 id="vitals-today" className={h2}>
          Today
        </h2>
        <ul className="mt-2 grid gap-1 text-sm text-silver-100">
          <li>
            <Link href="/body#water" className="hover:text-gold-300">
              💧 {body.waterToday} / 8 glasses
            </Link>
          </li>
          <li>
            <Link href="/mind/cards" className="hover:text-gold-300" data-testid="cards-due">
              🃏 {cards.due.length} card{cards.due.length === 1 ? "" : "s"} due
            </Link>
          </li>
          <li>
            <Link href="/mind#focus" className="hover:text-gold-300">
              ⏳ {focus.todayMinutes} min focus
            </Link>
          </li>
          <li>
            <Link href="/settings" className="hover:text-gold-300">
              🔔 {reminder.enabled ? `Reminder at ${reminder.time}` : "Daily reminder off"}
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
