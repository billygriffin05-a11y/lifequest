import { BOSS_GOLD_REWARD, BOSS_XP_REWARD, type BossBattle } from "../progress";

const num = new Intl.NumberFormat("en-GB");

/** This week's boss: good deeds deal damage, bad habits heal it. */
export function BossCard({ boss, wins }: { boss: BossBattle; wins: number }) {
  const pct = Math.round((boss.hpLeft / boss.hp) * 100);
  return (
    <section
      aria-labelledby="boss-heading"
      data-testid="boss"
      className={`rounded-2xl border p-5 ${boss.defeated ? "border-emerald-500/50 bg-emerald-700/10" : "border-ember-500/40 bg-obsidian-900/80"}`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span aria-hidden="true" className={`text-5xl ${boss.defeated ? "opacity-50 grayscale" : ""}`}>
          {boss.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-[0.25em] text-silver-300">Weekly boss</p>
          <h2 id="boss-heading" className="font-display text-xl text-gold-300">
            {boss.name}
          </h2>
        </div>
        <p className="text-sm text-silver-300">{wins} defeated so far</p>
      </div>
      <div
        role="progressbar"
        aria-label={`${boss.name} health`}
        aria-valuemin={0}
        aria-valuemax={boss.hp}
        aria-valuenow={boss.hpLeft}
        className="mt-3 h-3 overflow-hidden rounded-full bg-obsidian-700"
      >
        <div className="h-full rounded-full bg-ember-500 transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-sm text-silver-300" data-testid="boss-status">
        {boss.defeated
          ? `Defeated! +${BOSS_XP_REWARD} XP and +${BOSS_GOLD_REWARD} gold. A new boss arrives on Monday.`
          : `${num.format(boss.hpLeft)} / ${num.format(boss.hp)} HP left · you dealt ${num.format(boss.damage)}, bad habits healed ${num.format(boss.healed)}.`}
      </p>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-silver-300" aria-label="Damage this week" data-testid="boss-damage">
        <li>⚔️ Deeds {num.format(boss.damage)}</li>
        <li>💪 Training {num.format(boss.activity.training)}</li>
        <li>🧠 Study {num.format(boss.activity.study)}</li>
        <li>💧 Wellbeing {num.format(boss.activity.wellbeing)}</li>
        <li className="text-ember-300">🩸 Healed {num.format(boss.healed)}</li>
      </ul>
    </section>
  );
}
