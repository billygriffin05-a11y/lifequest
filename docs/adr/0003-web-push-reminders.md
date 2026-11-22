# ADR 0003 — Web Push reminders from the PC

- Status: accepted (owner request, 2026-11-20: "build all" of the researched features)
- Context: the owner uses LIFEQUEST as a Home Screen app on iPhone (iOS 16.4+ supports Web Push for
  Home Screen web apps after a user-initiated permission grant). Habit research favours timely cues.

## Decision

- Add the `web-push` library (no install scripts) and two tables: `PushSubscription` (endpoint + keys)
  and `PushLog` (one row per reminder key, so each fires at most once).
- VAPID key pair is generated on first use into `<data>/secrets/vapid.json` (owner-only), never in the DB,
  repo or logs. The VAPID contact is a placeholder (`owner@lifequest.invalid`), not the owner's address.
- The PC checks every minute which reminders are due (pure rules in `features/notifications/rules.ts`) and
  sends them. Reminders more than 3 hours late (PC was off) are skipped, not sent late.
- Only push-service endpoints (Apple, Google FCM, Microsoft WNS, Mozilla) are accepted, preventing the
  server from being used to POST to arbitrary URLs.
- Payloads are minimal: title, short text and an in-app path — no amounts, health data or notes.

## Consequences

- Reminders need the PC running (consistent with local-first). Expired subscriptions (404/410) are removed.
