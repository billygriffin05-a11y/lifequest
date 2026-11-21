import { connection } from "next/server";
import { prisma } from "@/server/db/client";
import { getDragons } from "../server/service";
import { partyStats } from "../stats";

/** Five RPG stats from your dragons' XP; they grow as each life area does. */
export async function PartyStats() {
  await connection();
  const dragons = await getDragons(prisma);
  const stats = partyStats(new Map(dragons.map((d) => [d.area.id, d.growth.xp])));
  return (
    <section aria-labelledby="stats-heading" className="mb-6 rounded-2xl border border-gold-500/40 bg-obsidian-900/80 p-5" data-testid="party-stats">
      <h2 id="stats-heading" className="font-display text-xl text-gold-300">
        Party stats
      </h2>
      <p className="mt-1 text-sm text-silver-300">Your dragons&apos; XP becomes character stats. Training, study and wellbeing also strike the weekly boss.</p>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((s) => (
          <li key={s.id} className="rounded-xl border border-obsidian-600 bg-obsidian-950/60 p-3">
            <p className="flex items-baseline justify-between gap-2">
              <span className="text-silver-100">
                <span aria-hidden="true">{s.icon}</span> {s.name}
              </span>
              <span className="font-display text-lg text-gold-300">Lv {s.level}</span>
            </p>
            <div
              role="progressbar"
              aria-label={`${s.name} progress to level ${s.level + 1}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={s.percent}
              className="mt-2 h-2 overflow-hidden rounded-full bg-obsidian-700"
            >
              <div className="h-full rounded-full bg-emerald-400" style={{ width: `${s.percent}%` }} />
            </div>
            <p className="mt-1 text-xs text-silver-300">{s.blurb}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
