"use client";

import { useEffect, useState } from "react";

export interface Milestones {
  rankLevel: number;
  rankTitle: string;
  /** Per area id: current stage index and display info. */
  dragons: Record<string, { stage: number; stageName: string; name: string }>;
}

const KEY = "lq.milestones.v1";

/** Pure: which celebrations to show, given what was seen last time. Exported for tests. */
export function celebrationsFor(prev: Milestones | null, now: Milestones): string[] {
  if (!prev) return []; // first visit: just remember, don't celebrate
  const out: string[] = [];
  if (now.rankLevel > prev.rankLevel) out.push(`⚔️ You've risen to ${now.rankTitle}!`);
  for (const [id, d] of Object.entries(now.dragons)) {
    const before = prev.dragons[id]?.stage ?? 0;
    if (d.stage > before) out.push(`🐉 ${d.name} grew into a ${d.stageName}!`);
  }
  return out;
}

/**
 * Shows a celebration banner when your rank or a dragon's stage went up since
 * your last visit. "Last seen" lives in this browser's localStorage (a per-viewer
 * convenience — nothing personal beyond levels).
 */
export function LevelUp({ now }: { now: Milestones }) {
  const [messages, setMessages] = useState<string[]>([]);

  useEffect(() => {
    let prev: Milestones | null = null;
    try {
      const raw = localStorage.getItem(KEY);
      prev = raw ? (JSON.parse(raw) as Milestones) : null;
    } catch {
      prev = null;
    }
    const found = celebrationsFor(prev, now);
    try {
      localStorage.setItem(KEY, JSON.stringify(now));
    } catch {
      /* storage blocked — just don't remember */
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading browser storage after mount
    if (found.length) setMessages(found);
  }, [now]);

  if (messages.length === 0) return null;
  return (
    <div role="status" className="lq-pop rounded-2xl border border-gold-500/60 bg-gold-500/15 p-4 text-gold-300" data-testid="level-up">
      <ul className="grid gap-1 font-display text-lg">
        {messages.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => setMessages([])}
        className="mt-2 min-h-11 rounded-lg px-3 text-sm text-silver-100 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-emerald-400"
      >
        Hurrah! (dismiss)
      </button>
    </div>
  );
}
