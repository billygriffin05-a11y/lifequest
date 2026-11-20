# Application integrations

Status: **Google Calendar is implemented** (owner-requested; needs the owner's own Google OAuth client — see
`/settings`). Open Banking, notifications and recipes are designed, not implemented. Each integration must be approved
before any real account is connected.

## Data leaving the PC

| Integration | What leaves the PC | Why | Stored where permanently |
|---|---|---|---|
| Google Calendar | OAuth tokens to Google; for each logged deed: its name, icon, points and time. Read requests for the owner's calendar list and events in the date range being viewed | Show deeds in a dedicated "LIFEQUEST" Google calendar; show the owner's own events (e.g. "Pay rent") in the in-app Calendar | Ledger stays in SQLite (source of truth); Google holds a copy of the deed events. Google events read back are **never stored** — memory only, ~2 minutes |
| Open Banking provider | OAuth consent flow; API calls with access token | Read-only import of balances/transactions | Transactions stored locally; provider/bank already hold them |
| Web Push | Encrypted notification payload (title, short text, in-app link) via the device's push service (Apple/Google/Microsoft/Mozilla only) | Reminders you switch on: streak at risk, cards due, if-then plans, budget nearly used | Not stored externally. Payloads never include amounts or health data. VAPID keys live in `<data>/secrets/vapid.json` |
| Recipe publishers | HTTP request for a recipe URL you choose to import | Save genuine recipe + attribution | Metadata + URL locally |
| Tailscale | Device metadata to Tailscale coordination server; traffic is end-to-end WireGuard | Private PC↔iPhone link | Nothing |
| GitHub | Source code only | Version control/CI | Code only — never data |

Anything not on this list must not send personal data off the PC without an update here and your approval.

## Google Calendar

**Implemented:** push deeds to Google, and read the owner's events for display. `src/features/calendar`, `/calendar`,
`/settings`, `/api/integrations/google/{start,callback}`. See `docs/adr/0002-google-calendar-read-access.md`.
- Scopes: **`calendar.app.created`** (write only to the "LIFEQUEST" calendar it creates) +
  **`calendar.calendarlist.readonly`** + **`calendar.events.readonly`** (read the owner's other calendars to display them).
  LIFEQUEST never creates, edits or deletes the owner's own events.
- Reading: `server/google-events.ts` lists the calendars shown in Google (skipping LIFEQUEST's own and hidden ones) and
  fetches events for the visible range with recurring events expanded. Results live in an in-memory cache for 2 minutes,
  never in the database or logs. Connections made before read access existed get a 403 → the UI asks to **Re-link**.
- OAuth: authorization code + PKCE + `state` (HttpOnly cookies, 10-minute life); callback only reports fixed result codes.
- Tokens: AES-256-GCM encrypted in the `GoogleConnection` table; key in `%LOCALAPPDATA%\LIFEQUEST\secrets\token.key`.
- Sync: logging/undoing a deed queues a `CalendarOutbox` item; it's pushed right after the request (`after()`), retried
  every 5 minutes, and given up after 8 attempts (shown on `/settings`). Event ids are derived from the entry id, so
  retries never duplicate events. Logging never waits on, or fails because of, Google.
- Unlink revokes the token at Google and forgets it locally; existing events stay in the owner's Google calendar.
- Not yet: storing/syncing Google events locally (two-way sync) — the design below still applies if that's added.

Original design notes:

- **Setup (you):** Google Cloud Console → new project → enable *Google Calendar API* → OAuth consent screen (External, Testing mode, add yourself as test user) → OAuth client "Web application" with redirect `http://localhost:3000/api/integrations/google/callback` (and the Tailscale HTTPS URL later). Put IDs in `.env.local`.
- **Scopes:** start with `calendar.events` limited to a **dedicated "LIFEQUEST" calendar** the app creates, plus `calendar.readonly` for showing other events. Least privilege.
- **Sync:** incremental sync with `syncToken` (handle `410 Gone` → full resync); store `googleEventId`, `etag`, `calendarId` locally.
- **No duplicates:** each LIFEQUEST event stores a stable `lifequestId` in Google's `extendedProperties.private`; upsert by that key; idempotent writes.
- **Recurring events:** store the RRULE on the master; exceptions as instances with `recurringEventId` + `originalStartTime`; never expand infinitely — expand a rolling window locally.
- **Tokens:** refresh token encrypted at rest (AES-256-GCM); revocation supported from settings.
- Testing-mode OAuth refresh tokens expire after 7 days — fine for development; publishing the app for personal use requires Google verification only for sensitive scopes beyond your own account.

## UK Open Banking (read-only)

- **Never** store bank credentials (the bank's own login page handles them) and **never** initiate payments.
- Use an **FCA-authorised AISP** so LIFEQUEST itself does not need FCA authorisation for account information.
- **TrueLayer** — sandbox is free and self-serve with mock banks. Production access is a separate approval aimed at
  organisations; sandbox work does not entitle you to production and pricing isn't public. *(Verify directly with TrueLayer before relying on it for personal use.)*
- **GoCardless Bank Account Data** (formerly Nordigen) — historically free for personal use, but third-party reports say new
  sign-ups are disabled. *(Unconfirmed — check bankaccountdata.gocardless.com.)*
- Other candidates to evaluate: Yapily, Plaid (UK), Moneyhub, Finexer. Fallback that needs no provider: **import CSV/OFX
  statements** downloaded from your bank — fully local, zero third parties. Recommended as phase-1 finance import.
- **Consent:** AIS consent typically needs reconfirming periodically (commonly every 90 days in the UK); design a re-consent reminder.
- **Storage:** transactions in integer pence with provider transaction ID as idempotency key (no duplicate imports); categorisation runs locally.
- Development: sandbox credentials only (`TRUELAYER_ENV=sandbox`).

## Notifications

- **Windows/desktop:** Web Push + Notifications API from the installed PWA (Edge/Chrome).
- **iPhone:** Web Push works for Home Screen PWAs on iOS 16.4+, over HTTPS (Tailscale Serve provides it), after a user gesture grants permission.
- **Scheduling:** reminders are stored locally; a scheduler on the PC sends pushes (VAPID keys generated locally). If the PC is off, pushes don't fire — the PWA shows missed reminders on next open.
- **Preferences:** per-category toggles, quiet hours, stored locally.

## Recipes (genuine sources only)

- **Never fabricate recipes or nutrition values.** If data isn't available from the source, show "not provided".
- Import flow: you paste a URL from BBC Good Food, EatingWell, NHS, British Heart Foundation, etc. → the PC fetches the page once and reads the publisher's **schema.org `Recipe` JSON-LD** (title, ingredients, steps, nutrition if published).
- Always store and display **publisher name, original URL, author and import date**, with a link back.
- Personal use only; respect each site's terms and robots.txt; no bulk crawling or redistribution. Check terms per publisher before enabling it. NHS content may be available under its syndication terms.
- Nutrition for home-made meals: compute from a reputable food-composition dataset (e.g. UK CoFID) — cite the dataset.

## Supabase (optional, not enabled)

Only if a relay is ever needed (e.g. sync without Tailscale): Supabase would store **client-side-encrypted** change blobs only, never
plaintext, never as source of truth. Requires your explicit approval and an ADR.
