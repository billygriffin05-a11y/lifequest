# ADR 0002 — Read the owner's Google Calendar events for display

- Status: accepted (owner request, 2026-11-20: "it should show what i have in my google calendar for that day")
- Context: the in-app Calendar only showed LIFEQUEST activity. The owner keeps real commitments (e.g. "Pay rent" on the
  1st of each month) in Google Calendar and wants them alongside deeds, in month, week and day views.

## Decision

- Add two **read-only** OAuth scopes: `calendar.calendarlist.readonly` and `calendar.events.readonly`, next to the
  existing `calendar.app.created` (write access stays limited to the app's own calendar). These are narrower than
  `calendar.readonly` and much narrower than `calendar`.
- Fetch events **live** for the date range on screen (`singleEvents=true` so recurring events are expanded by Google).
  Keep them in an in-process cache for 2 minutes only. **No new table; nothing written to SQLite, backups or logs.**
- Skip LIFEQUEST's own calendar (deeds already show from the local ledger) and calendars hidden in Google.
- Existing connections lack the new scopes; Google returns 403 and the UI shows a "Re-link" prompt. Re-linking keeps
  the existing LIFEQUEST calendar.

## Consequences

- Viewing the Calendar makes requests to Google (only when linked). If Google is unreachable, the page still shows
  local activity with a notice.
- Local-first is unchanged: the PC remains the source of truth for LIFEQUEST data; Google event data is never persisted.
- Two-way sync (storing Google events locally with sync tokens) remains a possible future step and would need its own ADR.
