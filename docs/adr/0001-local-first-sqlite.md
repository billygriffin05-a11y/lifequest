# ADR 0001 — Local-first: SQLite on the PC, Tailscale for the iPhone

- **Status:** Accepted (2026-11-18)
- **Context:** The original brief proposed Supabase (Postgres) with Replit/Vercel hosting. The owner then required that their
  Windows PC is the primary, authoritative owner of all personal data and that no cloud service silently becomes the permanent store.
- **Decision:**
  - SQLite database in `%LOCALAPPDATA%\LIFEQUEST`, accessed through Prisma 7 with the better-sqlite3 driver adapter.
  - Next.js runs on the PC (`next start`, bound to 127.0.0.1). No Replit, no Vercel.
  - iPhone access via Tailscale Serve (tailnet-only HTTPS). PWA with IndexedDB replica and outbox for offline use.
  - Separate production / development / test data directories.
  - Backups built in from day one (verified, checksummed, retention for automatic backups only, safe restore).
- **Alternatives considered:** Supabase as primary (rejected — cloud owner); Supabase as E2E-encrypted relay (kept as an option);
  Electron/Tauri desktop wrapper (possible later; not needed for a PWA); Drizzle ORM (fine, but Prisma was preferred by the owner).
- **Consequences:** The PC must be on for sync, notifications and integrations. The owner must keep external encrypted backups.
  No server-side hosting costs; no vendor lock-in for data.
