# LIFEQUEST environment setup report — 2026-11-18

Status key: **COMPLETE** (configured and verified) · **PENDING** (needs your login, approval or credentials) · **UNAVAILABLE** · **FAILED**

## Key decision
Following your local-first requirement, the stack changed from Supabase + Replit/Vercel to **SQLite on your PC (Prisma 7) +
Next.js served from your PC + Tailscale for the iPhone**. See `docs/adr/0001-local-first-sqlite.md`.

## Installed & configured

| Item | Status | Evidence |
|---|---|---|
| Git 2.56 and GitHub CLI 2.105 (winget, hash-verified installers) | COMPLETE | `git --version`, `gh --version` |
| Next.js 16.4.6 + React 19 + TypeScript 5.9 + Tailwind 4 + ESLint scaffold | COMPLETE | build succeeds |
| SQLite (better-sqlite3 12.11) + Prisma 7.10 with driver adapter | COMPLETE | migration applied; integration tests |
| Local data dir `%LOCALAPPDATA%\LIFEQUEST[-env]` with prod/dev/test separation | COMPLETE | unit tests; `npm run db:info` |
| Backups: automatic (on server start + hourly check), manual, verified (integrity + SHA-256), retention, safe restore, JSON export | COMPLETE | integration tests + CLI run on dev data |
| Pre-migrate backup on every migration | COMPLETE | `scripts/db.ts migrate` |
| Host allow-list (DNS-rebinding protection), security headers, 127.0.0.1 binding | COMPLETE | e2e tests |
| PWA manifest + icon (SVG) | COMPLETE (PNG/maskable icons to add in design phase) | e2e test |
| Vitest unit + integration suite (18 tests) | COMPLETE | 18/18 passed |
| Playwright e2e + axe accessibility, desktop Chromium + iPhone WebKit (16 tests) | COMPLETE | 16/16 passed |
| GitHub Actions: CI (lint, types, tests+coverage, build, e2e, npm audit, dependency review, gitleaks), CodeQL, Dependabot, PR template | PENDING | files written; they only run once the repo is on GitHub |
| `npm audit --omit=dev` | COMPLETE | 0 vulnerabilities |
| npm `allowScripts` allow-list (only better-sqlite3, prisma, @prisma/engines, esbuild may run install scripts) | COMPLETE | package.json |
| CLAUDE.md + README, DEVELOPMENT, ARCHITECTURE, SECURITY, TESTING, DEPLOYMENT, INTEGRATIONS, .env.example, ADR | COMPLETE | repo |
| 8 project skills in `.claude/skills` | COMPLETE | repo |
| `.claude/settings.json` guardrails (deny production data, `.env`, `migrate reset`, `db push`; ask before push/restore) | COMPLETE | repo |
| Project MCP: Prisma local (dev data only) | COMPLETE | handshake + tools/list verified |
| Playwright MCP plugin | COMPLETE | navigated the dev server and read the page |
| Local Git repo: `main` + `dev`, initial commit | COMPLETE | `git log` |

## Storage acceptance tests (requirement 12.H)

| # | Requirement | Status |
|---|---|---|
| 1 | Create data on the PC | COMPLETE (integration test) |
| 2 | Close and reopen without losing data | COMPLETE (new DB connection reads persisted row) |
| 3 | Data remains in the local DB file | COMPLETE |
| 4 | Back up the database | COMPLETE (verified + checksummed) |
| 5 | Restore a backup | COMPLETE (with pre-restore safety backup, tamper and path-traversal refusal) |
| 6 | Works without internet for local functionality | COMPLETE for the current shell (e2e proves zero external requests). Re-verify per feature. |
| 7 | iPhone can access synced data when the PC is available | PENDING: needs the sync phase + Tailscale on both devices |
| 8 | Offline changes sync later | PENDING: sync phase (design in ARCHITECTURE.md §4) |
| 9 | Conflicting edits handled safely | PENDING: sync phase (rules designed; idempotency primitive in place) |
| 10 | Database not publicly accessible | COMPLETE for the local server (127.0.0.1 bind, data dir outside web root, Host allow-list). Re-verify after Tailscale setup. |

## Needs your action

| Item | Status | What to do |
|---|---|---|
| GitHub sign-in | PENDING | `gh auth login` (browser, HTTPS, "Login with a web browser") |
| Git identity | PENDING | `git config --global user.name "<name>"` and `user.email "<id>+<login>@users.noreply.github.com"`, then `git commit --amend --reset-author --no-edit` on `main` and re-create `dev` from it |
| Create the private repo, push, protect `main` | PENDING | `.\scripts\github\setup-repo.ps1` (or ask Claude to run it after you sign in) |
| GitHub MCP connection | FAILED | Re-authenticate the GitHub plugin (`/mcp` in a Claude Code terminal, or toggle the plugin in claude.ai settings), then retry |
| Context7 | PENDING | Authorise via `/mcp` |
| Recommended plugins (frontend-design, feature-dev, code-simplifier, typescript-lsp, Superpowers) | PENDING | Install from the card in the conversation |
| Windows device encryption / BitLocker | PENDING | Settings → Privacy & security → Device encryption |
| Scheduled backups while the app is closed | PENDING | `.\scripts\windows\register-backup-task.ps1` |
| External encrypted backup | PENDING | BitLocker To Go USB drive; copy `%LOCALAPPDATA%\LIFEQUEST\backups` regularly |
| Tailscale (iPhone access) | PENDING (at sync phase) | DEPLOYMENT.md §2 |
| Google Cloud OAuth client | PENDING (at calendar phase) | INTEGRATIONS.md |
| Open Banking sandbox (TrueLayer) | PENDING (at finance phase) | Sandbox only. Production access for an individual is uncertain, so CSV/OFX import is the recommended first step. |

## Not available / not used
Replit and Vercel (replaced by PC hosting: they conflict with local-first), the Supabase MCP (Supabase not used), and the Figma MCP (no designs yet).

## Risks & limitations
- **Project folder is in a university OneDrive.** Code syncing is fine but slow with `node_modules`. Your personal data is **not** stored there (it lives in `%LOCALAPPDATA%`). Consider moving the repo to `C:\dev\lifequest`. If you leave the university, that OneDrive account may disappear (GitHub would still hold the code once pushed).
- Node 26 is used locally; CI uses Node 24 LTS. Both are supported by Prisma 7.
- Prisma CLI advertises v8 (release candidate). Stay on 7.x until 8 is stable.
- WebKit on Windows only approximates iPhone Safari. Real-device testing is needed in the sync phase.
- Sync, auth/device pairing, notifications and all integrations are designed but not implemented (as instructed).
- The initial commit uses a placeholder author (`LIFEQUEST Setup`) until you set your Git identity.

## Next steps
1. `gh auth login` → set your Git identity → run `scripts\github\setup-repo.ps1` → confirm CI goes green on GitHub.
2. Install the recommended plugins and authorise Context7 and GitHub MCP.
3. Turn on device encryption, then register the backup task.
4. Start application phase 1 (suggested order: design system and app shell → quests/XP core ledger → device pairing and sync → domains).
