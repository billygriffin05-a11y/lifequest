import Link from "next/link";
import { connection } from "next/server";
import { getDragons } from "@/features/dragons/server/service";
import { prisma } from "@/server/db/client";
import { QUEST_BONUS } from "../progress";
import { LIFEQUEST_TIME_ZONE, logMomentFor } from "../rules";
import { addStarterActionsAction, setArchivedAction } from "../server/actions";
import {
  getDailyTrend,
  getLoggedTodayActionIds,
  getPlayerProgress,
  getSummary,
  getTodayEntries,
  listActions,
  TREND_RANGES,
  type TrendRange,
} from "../server/service";
import { ActionForm } from "./action-form";
import { LogButton } from "./log-button";
import { LevelUp } from "./level-up";
import { NoteEditor } from "./note-editor";
import { RankCard } from "./rank-card";
import { TrendChart } from "./trend-chart";
import { UndoButton } from "./undo-button";

function parseRange(raw: string | string[] | undefined): TrendRange {
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return (TREND_RANGES as readonly number[]).includes(n) ? (n as TrendRange) : 30;
}

const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: LIFEQUEST_TIME_ZONE, hour: "2-digit", minute: "2-digit" });
const num = new Intl.NumberFormat("en-GB");
const signed = (n: number) => (n > 0 ? `+${num.format(n)}` : n < 0 ? `−${num.format(-n)}` : "0");

const card = "rounded-2xl border border-obsidian-600 bg-obsidian-900/80 p-5";

export async function HonourBoard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection(); // personal data: always read at request time, never prerendered
  const sp = await searchParams;
  const range = parseRange(sp.range);
  const day = sp.day === "yesterday" ? "yesterday" : "today";
  const logDate = logMomentFor(day);
  const [summary, active, all, today, trend, doneToday, progress, dragons] = await Promise.all([
    getSummary(prisma),
    listActions(prisma),
    listActions(prisma, { includeArchived: true }),
    getTodayEntries(prisma),
    getDailyTrend(prisma, range),
    getLoggedTodayActionIds(prisma, logDate),
    getPlayerProgress(prisma),
    getDragons(prisma),
  ]);
  const good = active.filter((a) => a.kind === "good");
  const bad = active.filter((a) => a.kind === "bad");

  const milestones = {
    rankLevel: progress.rank.level,
    rankTitle: progress.rank.title,
    dragons: Object.fromEntries(
      dragons.map((d) => [d.area.id, { stage: d.growth.stage, stageName: d.growth.stageName, name: d.displayName }]),
    ),
  };

  return (
    <div className="grid gap-6">
      <LevelUp now={milestones} />
      {/* Scores */}
      <section aria-labelledby="scores-heading" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <h2 id="scores-heading" className="sr-only">
          Scores
        </h2>
        <RankCard rank={progress.rank} bonusXp={progress.bonusXp} />
        <div className={`${card} border-gold-500/40`}>
          <p className="text-xs uppercase tracking-[0.25em] text-silver-300">Honour</p>
          <p data-testid="honour-total" className="mt-2 font-display text-4xl font-bold text-gold-300">
            {signed(summary.honour)}
          </p>
        </div>
        <div className={card}>
          <p className="text-xs uppercase tracking-[0.25em] text-silver-300">Total XP</p>
          <p data-testid="xp-total" className="mt-2 font-display text-4xl font-bold text-emerald-300">
            {num.format(progress.totalXp)}
          </p>
          {progress.bonusXp > 0 && (
            <p className="mt-1 text-sm text-silver-300">
              {num.format(summary.xp)} + <span className="text-gold-300">🔥 {num.format(progress.bonusXp)}</span> streak bonus
            </p>
          )}
        </div>
        <div className={card}>
          <p className="text-xs uppercase tracking-[0.25em] text-silver-300">Today</p>
          <p data-testid="today-net" className="mt-2 font-display text-4xl font-bold text-silver-100">
            {signed(summary.today.net)}
          </p>
          <p className="mt-1 text-sm text-silver-300">
            <span className="text-emerald-300">+{num.format(summary.today.good)} good</span> ·{" "}
            <span className="text-ember-300">−{num.format(summary.today.bad)} bad</span>
          </p>
        </div>
      </section>

      {/* Trend */}
      <section aria-labelledby="trend-heading" className={`${card} min-w-0`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="trend-heading" className="font-display text-xl text-gold-300">
            Good vs bad
          </h2>
          <nav aria-label="Chart range" className="flex flex-wrap gap-1">
            {TREND_RANGES.map((r) => (
              <Link
                key={r}
                href={`/honour?range=${r}`}
                scroll={false}
                aria-current={r === range ? "page" : undefined}
                className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${
                  r === range
                    ? "border-gold-500/60 bg-gold-500/10 font-semibold text-gold-300"
                    : "border-obsidian-600 text-silver-300 hover:text-silver-100"
                }`}
              >
                {r} days
              </Link>
            ))}
          </nav>
        </div>
        <p className="mt-1 text-sm text-silver-300">
          Points from good deeds and bad habits each day — last {range} days.
        </p>
        <div className="mt-4">
          <TrendChart data={trend} />
        </div>
      </section>

      {/* Daily quests */}
      {progress.quests.length > 0 && (
        <section aria-labelledby="quests-heading" className={`${card} border-gold-500/40`} data-testid="quests">
          <h2 id="quests-heading" className="font-display text-xl text-gold-300">
            Today&apos;s quests
          </h2>
          <p className="mt-1 text-sm text-silver-300">Complete these good deeds today for +{QUEST_BONUS} bonus XP each.</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-3">
            {progress.quests.map((q) => (
              <li
                key={q.actionId}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${
                  q.done ? "border-emerald-500/50 bg-emerald-700/15" : "border-obsidian-600"
                }`}
              >
                <span aria-hidden="true" className="text-2xl">
                  {q.icon}
                </span>
                <span className="flex-1 text-silver-100">{q.name}</span>
                <span className={q.done ? "text-emerald-300" : "text-silver-300"}>{q.done ? "✓ Done" : `+${QUEST_BONUS} XP`}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Log for today / yesterday */}
      <div className="flex flex-wrap items-center gap-3 text-sm" data-testid="day-toggle">
        {day === "yesterday" ? (
          <>
            <p role="status" className="rounded-lg border border-gold-500/50 bg-gold-500/10 px-3 py-2 text-gold-300">
              Logging for <strong>yesterday</strong>. Each action still counts once per day.
            </p>
            <Link href="/honour" scroll={false} className="inline-flex min-h-11 items-center text-emerald-300 underline underline-offset-4">
              Back to today
            </Link>
          </>
        ) : (
          <Link href="/honour?day=yesterday" scroll={false} className="inline-flex min-h-11 items-center text-silver-300 underline underline-offset-4 hover:text-gold-300">
            Forgot something yesterday?
          </Link>
        )}
        <span className="text-silver-500" aria-hidden="true">·</span>
        <Link href="/honour/history" className="inline-flex min-h-11 items-center text-silver-300 underline underline-offset-4 hover:text-gold-300">
          Habit heatmap
        </Link>
        <span className="text-silver-500" aria-hidden="true">·</span>
        <a href="/api/export/ledger" className="inline-flex min-h-11 items-center text-silver-300 underline underline-offset-4 hover:text-gold-300">
          Export CSV
        </a>
      </div>

      {/* Log */}
      {active.length === 0 ? (
        <section className={`${card} text-center`} aria-labelledby="empty-heading">
          <h2 id="empty-heading" className="font-display text-xl text-gold-300">
            Your ledger is empty
          </h2>
          <p className="mx-auto mt-2 max-w-md text-silver-300">
            Create your own good and bad actions below. They stay in your list every day — just tap to log them.
          </p>
          <form action={addStarterActionsAction} className="mt-4">
            {all.length === 0 && (
              <button
                type="submit"
                className="min-h-11 rounded-lg border border-gold-500/50 px-4 text-gold-300 hover:bg-gold-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-300"
              >
                Add starter examples
              </button>
            )}
          </form>
        </section>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <section aria-labelledby="good-heading" className={`${card} border-emerald-500/30`}>
            <h2 id="good-heading" className="font-display text-xl text-emerald-300">
              Good deeds
            </h2>
            {good.length ? (
              <ul className="mt-4 grid gap-3">
                {good.map((a) => (
                  <li key={a.id}>
                    <LogButton actionId={a.id} name={a.name} icon={a.icon} points={a.points} kind="good" category={a.category} doneToday={doneToday.has(a.id)} streak={progress.streaks[a.id] ?? 0} weekly={progress.weekly[a.id]} day={day} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-silver-300">No good actions yet — add one below.</p>
            )}
          </section>
          <section aria-labelledby="bad-heading" className={`${card} border-ember-500/30`}>
            <h2 id="bad-heading" className="font-display text-xl text-ember-300">
              Bad habits
            </h2>
            {bad.length ? (
              <ul className="mt-4 grid gap-3">
                {bad.map((a) => (
                  <li key={a.id}>
                    <LogButton actionId={a.id} name={a.name} icon={a.icon} points={a.points} kind="bad" category={a.category} doneToday={doneToday.has(a.id)} day={day} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-silver-300">No bad habits yet — add one below.</p>
            )}
          </section>
        </div>
      )}

      {/* Today's chronicle */}
      <section aria-labelledby="today-heading" className={card}>
        <h2 id="today-heading" className="font-display text-xl text-gold-300">
          Today&apos;s chronicle
        </h2>
        {today.length === 0 ? (
          <p className="mt-3 text-silver-300">Nothing logged yet today.</p>
        ) : (
          <ul className="mt-4 divide-y divide-obsidian-700" data-testid="today-list">
            {today.map((e) => (
              <li key={e.id} className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <span aria-hidden="true" className="text-xl">
                  {e.icon}
                </span>
                <span className={`min-w-0 flex-1 ${e.undone ? "text-silver-500 line-through" : "text-silver-100"}`}>
                  {e.name}
                  <span className="ml-2 text-xs text-silver-300">{timeFmt.format(e.occurredAt)}</span>
                  {e.note && (
                    <span className="block text-sm italic text-silver-300" data-testid="entry-note">
                      “{e.note}”
                    </span>
                  )}
                </span>
                <span className={`font-semibold ${e.honourDelta >= 0 ? "text-emerald-300" : "text-ember-300"}`}>
                  {signed(e.honourDelta)}
                </span>
                {!e.undone && <NoteEditor entryId={e.id} name={e.name} note={e.note} />}
                {e.undone ? <span className="text-sm text-silver-300">Undone</span> : <UndoButton entryId={e.id} name={e.name} />}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Manage */}
      <section aria-labelledby="manage-heading" className={card}>
        <h2 id="manage-heading" className="font-display text-xl text-gold-300">
          Customise your actions
        </h2>
        <div className="mt-4 rounded-xl border border-obsidian-700 p-4">
          <h3 className="mb-3 font-medium text-silver-100">New action</h3>
          <ActionForm />
        </div>
        {all.length > 0 && (
          <ul className="mt-4 grid gap-2">
            {all.map((a) => (
              <li key={a.id} className="rounded-xl border border-obsidian-700 p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span aria-hidden="true" className="text-xl">
                    {a.icon}
                  </span>
                  <span className={`flex-1 ${a.archivedAt ? "text-silver-500" : "text-silver-100"}`}>
                    {a.name}
                    <span className="ml-2 text-xs text-silver-300">
                      {a.category} · {a.kind === "good" ? `+${a.points}` : `−${a.points}`}
                      {a.archivedAt ? " · archived" : ""}
                    </span>
                  </span>
                  <form action={setArchivedAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="archived" value={a.archivedAt ? "false" : "true"} />
                    <button
                      type="submit"
                      aria-label={`${a.archivedAt ? "Restore" : "Archive"} ${a.name}`}
                      className="min-h-11 rounded-lg border border-silver-500/40 px-3 text-sm text-silver-300 hover:text-gold-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                    >
                      {a.archivedAt ? "Restore" : "Archive"}
                    </button>
                  </form>
                </div>
                <details className="mt-2">
                  <summary className="min-h-11 cursor-pointer py-2 text-sm text-emerald-300">Edit {a.name}</summary>
                  <div className="pt-2">
                    <ActionForm
                      mode="edit"
                      initial={{
                        id: a.id,
                        name: a.name,
                        kind: a.kind === "bad" ? "bad" : "good",
                        points: a.points,
                        icon: a.icon,
                        category: a.category,
                        weeklyTarget: a.weeklyTarget,
                      }}
                    />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-sm text-silver-300">
          Editing points only affects future logs — your history keeps the values it was logged with. Archived actions keep their history.
        </p>
      </section>
    </div>
  );
}
