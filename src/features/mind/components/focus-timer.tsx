"use client";

import { useEffect, useState, useTransition } from "react";
import { FOCUS_LENGTHS } from "../rules";
import { logFocusAction } from "../server/actions";

type Running = { minutes: number; endsAt: number };

const fmt = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * Pomodoro timer. Counts against a fixed end time (not ticks), so a sleeping
 * tab or phone still finishes correctly. Logs the session when it completes.
 */
export function FocusTimer() {
  const [length, setLength] = useState<number>(25);
  const [label, setLabel] = useState("");
  const [running, setRunning] = useState<Running | null>(null);
  const [now, setNow] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      if (t >= running.endsAt) {
        const done = running;
        setRunning(null);
        start(async () => {
          const r = await logFocusAction({ minutes: done.minutes, label });
          setMessage(r.ok ? `✅ ${r.message}` : r.message);
        });
      }
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [running, label]);

  const left = running ? running.endsAt - now : length * 60_000;

  return (
    <div>
      <p className="font-display text-5xl tabular-nums text-silver-100" aria-live="off" data-testid="focus-clock">
        {fmt(left)}
      </p>
      {!running ? (
        <div className="mt-3 grid gap-3">
          <fieldset>
            <legend className="text-sm text-silver-300">Length</legend>
            <div className="mt-1 flex gap-2">
              {FOCUS_LENGTHS.map((m) => (
                <label
                  key={m}
                  className={`inline-flex min-h-11 cursor-pointer items-center rounded-lg border px-3 text-sm ${
                    length === m ? "border-gold-400 text-gold-300" : "border-obsidian-600 text-silver-300"
                  }`}
                >
                  <input type="radio" name="focus-length" value={m} checked={length === m} onChange={() => setLength(m)} className="sr-only" />
                  {m} min
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor="focus-label" className="text-sm text-silver-300">
              Working on (optional)
            </label>
            <input
              id="focus-label"
              value={label}
              maxLength={60}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Security+ domain 2"
              className="mt-1 block min-h-11 w-full rounded-lg border border-obsidian-600 bg-obsidian-950 px-3 text-silver-100 placeholder:text-silver-500"
            />
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setMessage(null);
              setRunning({ minutes: length, endsAt: Date.now() + length * 60_000 });
            }}
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-gold-500 px-4 text-sm font-semibold text-obsidian-950 hover:bg-gold-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
          >
            Start focus
          </button>
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-sm text-silver-300">Stay with it — the session logs itself when the timer ends.</p>
          <button
            type="button"
            onClick={() => {
              setRunning(null);
              setMessage("Session stopped — not logged.");
            }}
            className="mt-2 inline-flex min-h-11 items-center justify-center rounded-lg border border-silver-500/40 px-4 text-sm text-silver-300"
          >
            Give up
          </button>
        </div>
      )}
      <p role="status" className="mt-2 min-h-5 text-sm text-emerald-300" data-testid="focus-message">
        {message}
      </p>
    </div>
  );
}
