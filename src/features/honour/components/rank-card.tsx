import type { Rank } from "../progress";

const num = new Intl.NumberFormat("en-GB");

/** Player rank with progress to the next title. Pure presentational (server or client). */
export function RankCard({ rank, bonusXp, className = "" }: { rank: Rank; bonusXp: number; className?: string }) {
  return (
    <div className={`rounded-2xl border border-gold-500/40 bg-obsidian-900/80 p-5 ${className}`} data-testid="rank-card">
      <p className="text-xs uppercase tracking-[0.25em] text-silver-300">Rank · Level {rank.level}</p>
      <p className="mt-2 font-display text-3xl font-bold text-gold-300">{rank.title}</p>
      <div
        role="progressbar"
        aria-label={rank.nextTitle ? `Progress to ${rank.nextTitle}` : "Highest rank reached"}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={rank.percent}
        className="mt-3 h-2 overflow-hidden rounded-full bg-obsidian-700"
      >
        <div className="h-full rounded-full bg-gold-400" style={{ width: `${rank.percent}%` }} />
      </div>
      <p className="mt-2 text-sm text-silver-300">
        {num.format(rank.xp)} XP
        {rank.nextAt !== null && rank.nextTitle ? ` · ${rank.nextTitle} at ${num.format(rank.nextAt)}` : " · max rank"}
        {bonusXp > 0 && <span className="text-emerald-300"> · incl. 🔥 +{num.format(bonusXp)} streak bonus</span>}
      </p>
    </div>
  );
}
