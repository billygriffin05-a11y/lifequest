"use client";

import { useState, useTransition } from "react";
import { logActionAction } from "../server/actions";

interface Props {
  actionId: string;
  name: string;
  icon: string;
  points: number;
  kind: "good" | "bad";
  category: string;
  /** Already logged today (one per day). */
  doneToday?: boolean;
  /** Current streak in days (good actions). */
  streak?: number;
  /** This week's progress toward a weekly goal. */
  weekly?: { done: number; target: number };
  /** Log for yesterday instead of today. */
  day?: "today" | "yesterday";
  /** If-then plan cue, e.g. "After my morning coffee". */
  cue?: string | null;
  /** Streak shields banked (each covers one missed day). */
  shields?: number;
}

export function LogButton({ actionId, name, icon, points, kind, category, doneToday = false, streak = 0, weekly, day = "today", cue, shields = 0 }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const good = kind === "good";
  const signed = good ? `+${points}` : `−${points}`;

  return (
    <div>
      <button
        type="button"
        disabled={pending || doneToday}
        aria-label={
          doneToday
            ? `${name}: done ${day === "yesterday" ? "yesterday" : "today"}`
            : `Log ${name}${day === "yesterday" ? " for yesterday" : ""}: ${good ? "plus" : "minus"} ${points} Honour`
        }
        onClick={() =>
          startTransition(async () => {
            setError(null);
            // A fresh key per tap: retries of this request can never double-count.
            const result = await logActionAction({ actionId, idempotencyKey: crypto.randomUUID(), day });
            if (!result.ok) setError(result.message ?? "Could not log that.");
          })
        }
        className={`flex min-h-14 w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-transform duration-150 active:scale-[0.97] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${
          good
            ? "border-emerald-500/40 bg-emerald-700/15 hover:bg-emerald-700/25"
            : "border-ember-500/40 bg-ember-700/15 hover:bg-ember-700/25"
        }`}
      >
        <span aria-hidden="true" className="text-2xl leading-none">
          {icon}
        </span>
        <span className="flex-1">
          <span className="block font-medium text-silver-100">{name}</span>
          {cue && (
            <span className="block text-xs italic text-emerald-300" data-testid="cue">
              ↳ {cue}
            </span>
          )}
          <span className="block text-xs text-silver-300">
            {category}
            {streak >= 2 && (
              <span className="ml-2 font-semibold text-gold-300" data-testid="streak">
                🔥 {streak}-day streak
              </span>
            )}
            {shields > 0 && (
              <span className="ml-2 font-semibold text-emerald-300" data-testid="shields" title="Each shield covers one missed day">
                🛡️×{shields}
              </span>
            )}
            {weekly && (
              <span
                className={`ml-2 font-semibold ${weekly.done >= weekly.target ? "text-emerald-300" : "text-silver-100"}`}
                data-testid="weekly"
              >
                {weekly.done >= weekly.target ? "✓" : "📅"} {Math.min(weekly.done, weekly.target)}/{weekly.target} this week
              </span>
            )}
          </span>
        </span>
        {doneToday ? (
          <span className="text-sm font-semibold text-silver-300">✓ Done {day === "yesterday" ? "yesterday" : "today"}</span>
        ) : (
          <span className={`font-display text-lg font-bold ${good ? "text-emerald-300" : "text-ember-300"}`}>{signed}</span>
        )}
      </button>
      {error && (
        <p role="alert" className="mt-1 text-sm text-ember-300">
          {error}
        </p>
      )}
    </div>
  );
}
