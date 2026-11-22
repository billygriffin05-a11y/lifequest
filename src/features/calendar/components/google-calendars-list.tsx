import { connection } from "next/server";
import { londonDateKey } from "@/features/honour/rules";
import { findEvents, getCalendarOverview } from "../server/google-events";
import { calendarDeps } from "../server/runtime";

const monthFmt = new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" });

/** Settings: which Google calendars feed the in-app Calendar, with event counts. */
export async function GoogleCalendarsList({ find }: { find?: string }) {
  await connection();
  const today = londonDateKey(new Date());
  const from = `${today.slice(0, 7)}-01`;
  const [y, m] = today.split("-").map(Number);
  const to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  const query = (find ?? "").trim().slice(0, 60);
  const [o, found] = await Promise.all([
    getCalendarOverview(calendarDeps(), from, to),
    query ? findEvents(calendarDeps(), query, today) : Promise.resolve(null),
  ]);
  if (o.status === "not-configured" || o.status === "not-linked") return null;

  return (
    <section aria-labelledby="gcals-heading" className="mt-6 rounded-2xl border border-obsidian-600 bg-obsidian-900/80 p-5" data-testid="google-calendars">
      <h2 id="gcals-heading" className="font-display text-xl text-gold-300">
        Calendars LIFEQUEST can see
      </h2>
      {o.status === "needs-relink" && <p className="mt-2 text-sm text-gold-300">Re-link Google Calendar above to let LIFEQUEST read your calendars.</p>}
      {o.status === "error" && <p className="mt-2 text-sm text-ember-300">Couldn&apos;t reach Google just now. Try again in a minute.</p>}
      {o.status === "ok" && (
        <>
          <p className="mt-1 text-sm text-silver-300">
            Events in {monthFmt.format(new Date(`${from}T12:00:00Z`))}, per calendar. If something you expect is missing, check it&apos;s in one
            of these (and the same Google account).
          </p>
          <ul className="mt-3 divide-y divide-obsidian-700 text-sm">
            {o.calendars.map((c) => (
              <li key={c.name} className="flex items-center gap-3 py-2">
                <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-sm bg-silver-300" style={c.colour ? { backgroundColor: c.colour } : undefined} />
                <span className="min-w-0 flex-1 truncate text-silver-100">
                  {c.name}
                  {c.primary && <span className="ml-2 text-xs text-emerald-300">main</span>}
                </span>
                <span className={c.included ? "text-silver-300" : "text-silver-500"}>
                  {`${c.events ?? 0} event${c.events === 1 ? "" : "s"}`}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      <form method="get" action="/settings#gcals-heading" className="mt-4 flex flex-wrap items-end gap-2" aria-label="Find an event in Google">
        <div className="min-w-0 flex-1">
          <label htmlFor="find-event" className="text-sm text-silver-300">
            Find an event in Google (searches every calendar, a year either side)
          </label>
          <input
            id="find-event"
            name="find"
            defaultValue={query}
            maxLength={60}
            placeholder="e.g. rent"
            className="mt-1 block min-h-11 w-full rounded-lg border border-obsidian-600 bg-obsidian-950 px-3 text-silver-100"
          />
        </div>
        <button type="submit" className="min-h-11 rounded-lg border border-emerald-500/50 px-4 text-sm font-semibold text-emerald-300">
          Search
        </button>
      </form>
      {found && (
        <div className="mt-3" data-testid="find-results">
          {found.status !== "ok" ? (
            <p className="text-sm text-ember-300">Couldn&apos;t search Google ({found.status}).</p>
          ) : found.found.length === 0 ? (
            <p className="text-sm text-gold-300">
              Google has no event matching “{query}” in any of the {found.calendars} calendars on this account. It may be in a different account or
              in your iPhone&apos;s own (iCloud) calendar.
            </p>
          ) : (
            <ul className="divide-y divide-obsidian-700 text-sm">
              {found.found.map((e, i) => (
                <li key={i} className="flex flex-wrap gap-x-3 py-2">
                  <span className="min-w-0 flex-1 text-silver-100">{e.title}</span>
                  <span className="text-silver-300">{e.calendar}</span>
                  <span className="text-silver-300">{e.start.slice(0, 10)}</span>
                  <span className="text-silver-300">{e.repeats ? "repeats" : "one-off"}</span>
                  {(e.type !== "default" || e.status !== "confirmed") && (
                    <span className="text-gold-300">
                      {e.type} · {e.status}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
