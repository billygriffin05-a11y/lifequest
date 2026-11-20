/**
 * Pure mapping from a LIFEQUEST ledger entry to a Google Calendar event.
 * Only the deed's name, icon, points and time leave the PC (documented in
 * INTEGRATIONS.md "Data leaving the PC").
 */
export interface DeedForCalendar {
  id: string;
  kind: string;
  actionName: string;
  actionIcon: string;
  honourDelta: number;
  occurredAt: Date;
}

/**
 * Deterministic Google event id for an entry. Google ids must use base32hex
 * characters (0-9, a-v) and be 5–1024 long; hex-encoding the cuid satisfies that.
 * Same entry → same id, so creates and deletes are idempotent.
 */
export function eventIdFor(entryId: string): string {
  return `lq${Buffer.from(entryId, "utf8").toString("hex")}`;
}

const EVENT_MINUTES = 15;

/** Event description: what it was, plus the owner's note if there is one. */
export function eventDescriptionFor(kind: string, note?: string | null): string {
  const base = kind === "good" ? "Good deed logged in LIFEQUEST." : "Bad habit logged in LIFEQUEST.";
  return note ? `${note}\n\n${base}` : base;
}

export function eventBodyFor(deed: DeedForCalendar & { note?: string | null }) {
  const good = deed.kind === "good";
  const points = Math.abs(deed.honourDelta);
  const start = deed.occurredAt;
  const end = new Date(start.getTime() + EVENT_MINUTES * 60_000);
  return {
    id: eventIdFor(deed.id),
    summary: `${good ? "✅" : "❌"} ${deed.actionIcon} ${deed.actionName} (${good ? "+" : "−"}${points} Honour)`,
    description: eventDescriptionFor(deed.kind, deed.note),
    start: { dateTime: start.toISOString(), timeZone: "Europe/London" },
    end: { dateTime: end.toISOString(), timeZone: "Europe/London" },
    colorId: good ? "10" : "11", // Google palette: 10 = basil (green), 11 = tomato (red)
    transparency: "transparent", // doesn't block the owner's free/busy time
    extendedProperties: { private: { lifequestEntryId: deed.id } },
    reminders: { useDefault: false, overrides: [] },
  };
}
