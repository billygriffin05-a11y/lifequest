# Architecture

See also: [docs/adr/0001-local-first-sqlite.md](docs/adr/0001-local-first-sqlite.md).

## 1. Shape of the system

```
┌──────────────────────── Windows PC (data owner) ────────────────────────┐
│  next start  (127.0.0.1:3000)                                           │
│   ├─ proxy.ts            Host allow-list                                │
│   ├─ UI (React Server Components + client islands)                      │
│   ├─ Route handlers /api/* (sync, integrations, health)                 │
│   └─ src/server/*  ── Prisma ── SQLite  %LOCALAPPDATA%\LIFEQUEST\db     │
│                         backups\  exports\  logs\                        │
│  Scheduled task: npm run db -- auto-backup --env=production             │
│  Tailscale Serve: https://<pc>.<tailnet>.ts.net → http://127.0.0.1:3000 │
└───────────────────────────────▲─────────────────────────────────────────┘
                                │ WireGuard (Tailscale) + TLS, tailnet only
┌───────────────────────────────┴───────── iPhone ─────────────────────────┐
│  LIFEQUEST PWA (installed to Home Screen)                               │
│   ├─ Service worker: app shell cached for offline start                 │
│   ├─ IndexedDB: replica of synced data + outbox of offline changes      │
│   └─ Sync client: push outbox / pull changes when PC reachable          │
└─────────────────────────────────────────────────────────────────────────┘
External services (only when a feature needs them, documented in INTEGRATIONS.md):
Google Calendar API · Open Banking provider (read-only) · Apple/Mozilla/Google Web Push services · recipe publisher pages
```

## 2. Why local-first, and why not Supabase/Vercel/Replit

The requirement is that the PC is the authoritative owner of all personal data. Hosted platforms would make the cloud
the primary store. So:

- **SQLite** — single file, zero admin, robust, trivially backed up, works offline.
- **Prisma 7 + better-sqlite3 adapter** — typed queries and versioned SQL migrations.
- **Next.js on the PC** — one codebase serves UI and API; the PC is the server.
- **Tailscale** — private, authenticated, encrypted network between the user's devices; no router ports opened.
- Supabase is allowed only as an optional, explicitly-approved, **end-to-end-encrypted relay** (it would see ciphertext only).

## 3. Local storage

| Concern | Implementation (status) |
|---|---|
| Data directory | `src/server/config/paths.ts` — `%LOCALAPPDATA%\LIFEQUEST[-env]`; refuses folders inside the repo; warns for OneDrive/Dropbox ✅ |
| Separate data sets | `production` / `development` / `test` folders ✅ |
| Migrations | Prisma migrations in Git; `db migrate` always takes a `pre-migrate` backup first ✅ |
| Automatic backups | On server start + hourly check, honouring `LIFEQUEST_BACKUP_INTERVAL_HOURS` ✅; Windows scheduled task for when the app is closed (script provided, you register it) |
| Retention | `LIFEQUEST_BACKUP_RETAIN` — only `auto` backups are pruned; manual / pre-migrate / pre-restore are kept ✅ |
| Integrity | Every backup: SQLite online backup API → `PRAGMA integrity_check` → SHA-256 manifest ✅ |
| Restore | Verifies checksum + integrity, refuses while app runs (lock file), takes `pre-restore` backup, atomic swap ✅ |
| Export | `db export` → JSON of all tables ✅; per-domain CSV (e.g. transactions) to be added with features |
| Concurrency | WAL journal mode; single server process owns the DB |

## 4. iPhone synchronisation (design — to be implemented in the sync phase)

### Transport & access
- PC server stays bound to `127.0.0.1`. **Tailscale Serve** publishes it to the tailnet only, with an automatic HTTPS
  certificate for `<pc>.<tailnet>.ts.net` (HTTPS is required for service workers and Web Push on iOS).
- `LIFEQUEST_ALLOWED_HOSTS` must contain that hostname; any other Host header gets `421` (implemented).
- Never Tailscale **Funnel** (that would be public), never router port forwarding.

### Authentication
- **Device pairing:** the PC UI shows a QR code containing a one-time pairing code (short TTL). The iPhone exchanges it for
  a random 256-bit device token; the PC stores only its hash (`Device` table) and can revoke devices.
- Requests must carry the device token **and** arrive via Tailscale (Tailscale Serve adds identity headers such as
  `Tailscale-User-Login`, which the server checks against the owner's login).
- Sessions use HttpOnly, Secure, SameSite=Strict cookies.

### Data model for sync
- Every syncable row: `id` (cuid, generated on the creating device), `version`, `updatedAt` (hybrid logical clock),
  `updatedByDevice`, `deletedAt` (tombstone).
- PC keeps a monotonically increasing `SyncChange` log (`seq`, table, rowId, version).
- **Pull:** iPhone requests `changes since seq N` → applies to IndexedDB.
- **Push:** iPhone sends its outbox: `{opId, table, rowId, baseVersion, changedFields}`. `opId` is an idempotency key, so retries never double-apply.

### Conflict resolution (no silent data loss)
1. `baseVersion == current version` → apply, bump version.
2. Different versions but **different fields** changed → field-level merge.
3. Same field changed on both → **PC value wins**, the iPhone's value is stored in a `SyncConflict` record and surfaced
   in the UI ("Resolve conflicts") — the user decides; nothing is discarded.
4. **Ledgers are append-only** (transactions, XP grants, reward payouts, workout sets): conflicts cannot occur; duplicates are
   prevented by idempotency keys. Totals are always recomputed from ledgers.
5. Delete vs edit → edit wins and resurrects the row, conflict logged.

### Offline behaviour
- Service worker caches the app shell → the PWA opens with the PC switched off.
- Reads come from IndexedDB; writes go to the outbox; sync runs on app focus, on `online`, and on a timer when the PC is reachable.
- The app requests `navigator.storage.persist()`.

### Limitations (be honest about these)
- **The iPhone must reach the PC at least once** (initial install + first sync) and periodically for fresh data.
- With the PC off: no bank imports, no Google Calendar sync, **no push notifications** (the PC sends them), no new data from the PC.
- The iPhone holds a cached **copy** of synced data (protected by iOS device encryption). Losing the phone before a sync loses
  only unsynced offline edits.
- iOS may evict web app storage under severe storage pressure; unsynced outbox items are the only real risk, so sync often.
- Tailscale's coordination server sees device metadata (not traffic). Self-hosting the control plane (Headscale) is possible later.
- iPhone Web Push requires iOS 16.4+ and the PWA added to the Home Screen.

## 5. Gamification & finance integrity (design rules)
- XP, levels, achievements, dragon evolution and financial rewards are **derived from append-only event ledgers**.
- Every grant has an **idempotency key** (e.g. `reward:budget-month:2026-11`) enforced by a unique index — implemented on `AuditEvent`.
- Reward rules are pure functions with unit tests; amounts in integer pence; every financial/reward change writes an `AuditEvent`.

## 6. Module boundaries
`src/features/<domain>` own their UI, server actions, Zod schemas and tests. Cross-domain effects (e.g. "gym session → XP")
go through a typed domain-event function in `src/server/events`, never direct table writes into another domain.
