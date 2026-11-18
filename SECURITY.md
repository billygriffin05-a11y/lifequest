# Security

LIFEQUEST will hold financial, health and personal data for one person. Security is designed in from the start.

## Threat model (summary)

| Threat | Control |
|---|---|
| Database exposed to the internet | Server binds to `127.0.0.1`; remote access only through Tailscale Serve (tailnet-only); no port forwarding |
| Malicious website attacking the local server (DNS rebinding / CSRF) | Host allow-list in `src/proxy.ts` (✅ tested); SameSite=Strict cookies; Origin checks on mutating routes (with auth phase) |
| Stolen/lost iPhone | Device tokens revocable from the PC; iOS device encryption; no secrets in the PWA bundle |
| Personal data in Git | Data dir outside repo (enforced in code ✅); `.gitignore` blocks `*.db`, `.env*`; gitleaks in CI |
| Data synced to a third-party cloud by accident | Data dir defaults to `%LOCALAPPDATA%` (not OneDrive); warning if a cloud-synced path is configured ✅ |
| Data loss (bad migration, corruption, PC failure) | Pre-migrate backups ✅, verified backups ✅, safe restore ✅, scheduled backups, **external encrypted backup (you)** |
| Leaked API secrets | Env vars only, never `NEXT_PUBLIC_`; `server-only` imports; Claude denied from reading `.env*` |
| Token theft from DB file | OAuth tokens encrypted with AES-256-GCM ✅; key in `<data dir>/secrets/token.key`, outside the DB, backups and repo ✅ (wrapping it with Windows DPAPI is planned) |
| OAuth login CSRF / code interception | `state` + PKCE (S256) ✅; least-privilege `calendar.app.created` scope ✅ |
| Duplicate / manipulated rewards | Append-only ledgers, unique idempotency keys ✅, server-side calculation only, audit trail ✅ |
| Vulnerable dependencies | `npm audit` + Dependency Review + Dependabot + CodeQL in CI; npm `allowScripts` allow-list |
| Sensitive data in logs | Logs record IDs/counts/status only; config errors report key names, never values ✅ |

## Encryption at rest

- **Turn on Windows Device Encryption / BitLocker** (Settings → Privacy & security → Device encryption). This protects the
  database, backups and exports if the PC is stolen. *(Requires your action — PENDING.)*
- Field-level encryption for OAuth refresh tokens and other secrets (planned with the first integration).
- Full-database encryption (SQLCipher via `better-sqlite3-multiple-ciphers`) is an option if needed; it adds key-management
  complexity, so it is deferred until there is a concrete need.

## External backups (strongly recommended)

Local backups do not survive disk failure, theft or ransomware. Copy `%LOCALAPPDATA%\LIFEQUEST\backups` regularly to an
**encrypted external drive** (BitLocker To Go) kept disconnected when not in use. If you prefer cloud backup, upload only
**encrypted archives** (e.g. 7-Zip AES-256 with a strong passphrase) — never the raw database. Do not put the live database
in OneDrive (especially a university account).

## Secure development rules

See CLAUDE.md §7. In short: validate inputs with Zod, Prisma/prepared statements only, no secrets in code or logs,
least-privilege OAuth scopes (read-only first), sandbox credentials only during development, `/security-review` on sensitive changes.

## Reporting

Single-owner project. Record security findings as private GitHub issues labelled `security`, or in `docs/security-log.md`.
