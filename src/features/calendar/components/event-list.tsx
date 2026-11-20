import type { CalEvent } from "../google/event-mapping";

/** Google events for one day: colour dot, time (or "All day"), title, calendar. */
export function EventList({ events, compact = false }: { events: readonly CalEvent[]; compact?: boolean }) {
  if (!events.length) return null;
  return (
    <ul className={compact ? "grid gap-0.5" : "grid gap-1"} data-testid="google-events">
      {events.map((e) => (
        <li key={e.id} className={`flex items-baseline gap-2 ${compact ? "text-xs" : "text-sm"}`}>
          <span
            aria-hidden="true"
            className="inline-block h-2 w-2 shrink-0 rounded-full bg-silver-300"
            style={e.colour ? { backgroundColor: e.colour } : undefined}
          />
          <span className="w-14 shrink-0 tabular-nums text-silver-300">{e.allDay ? "All day" : (e.start ?? "…")}</span>
          <span className="min-w-0 flex-1 text-silver-100">
            {e.title}
            {!compact && <span className="ml-2 text-xs text-silver-300">· {e.calendar}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
