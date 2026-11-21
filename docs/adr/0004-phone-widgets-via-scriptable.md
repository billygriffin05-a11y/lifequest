# ADR 0004 — iPhone widgets via Scriptable

- Status: accepted (owner request, 2026-11-21: "turn stuff into widgets for my lock screen and home screen")
- Context: iOS Home Screen and Lock Screen widgets must come from an installed native app (WidgetKit). A
  Home Screen web app (LIFEQUEST) cannot provide them, and building a native app is out of scope.

## Decision

- Add a read-only JSON feed `GET /api/widget` (rank, XP, quests, best streak, boss, cards due, water glasses,
  favourite dragon, next events/bills: title + day + time only). No money amounts, journal text or health
  figures beyond water. Protected by the existing host allow-list (localhost + Tailscale name only).
- Provide a script for the free **Scriptable** iOS app (`/widgets` setup page with a copy button). The script runs
  on the owner's phone and fetches the feed over Tailscale; no third-party server is involved.
- One script covers small/medium/large Home Screen widgets and rectangular/circular/inline Lock Screen widgets;
  the widget Parameter picks today / calendar / dragon.

## Consequences

- Widgets need the PC on and Tailscale connected; otherwise they show "offline". iOS controls refresh timing.
- No new outbound data flow from the PC (the phone pulls over the tailnet, like the app itself).
