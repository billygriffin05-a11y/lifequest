---
name: calendar-integration
description: LIFEQUEST calendar features and Google Calendar sync — events, recurrence, reminders, OAuth tokens and duplicate prevention. Use when working on calendar data, the Google integration or scheduled notifications.
---

# Calendar & Google Calendar

Read INTEGRATIONS.md §Google Calendar first.

- **Local first:** LIFEQUEST events live in SQLite. Google is a sync target, not the source of truth.
- **Mapping table:** `{lifequestEventId, googleCalendarId, googleEventId, etag, lastSyncedAt}`. Write `extendedProperties.private.lifequestId` on Google events, then upsert by that key to avoid duplicates.
- **Incremental sync:** store `nextSyncToken` per calendar. On HTTP 410, clear it and do a full resync with de-duplication by `lifequestId` and `iCalUID`.
- **Recurrence:** store the RRULE (RFC 5545) on the master event and the exceptions separately, and expand only a rolling window (e.g. -30/+180 days). Times are stored in UTC with an IANA timezone (`Europe/London`), and expansion respects BST changes.
- **Conflicts:** if a Google `etag` changed since the last sync and the local row also changed, apply the ARCHITECTURE.md conflict rules and record a conflict. Never silently overwrite.
- **Scopes:** least privilege, using a dedicated "LIFEQUEST" calendar for writes. The refresh token is encrypted at rest. Handle `invalid_grant` by prompting the user to reconnect.
- **Reminders:** stored locally and sent by the PC scheduler via Web Push. Payloads stay minimal.
- **Tests:** mock the Google API at the HTTP boundary. Cover duplicates, 410 resync, recurring exceptions, timezone and DST, and token refresh failure. Never call the real API in CI.
