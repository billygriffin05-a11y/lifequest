# Development guide

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 24 LTS (CI) — 26 also works locally | `.nvmrc` pins 24 for CI |
| npm | 11+ | `allowScripts` in package.json lists packages allowed to run install scripts |
| Git | 2.5x | installed via `winget install Git.Git` |
| GitHub CLI | 2.10x | `gh auth login` once |
| Tailscale | latest | only needed for iPhone access (see DEPLOYMENT.md) |

> **Project location.** The repo currently lives in a OneDrive folder. Code in OneDrive is acceptable, but `node_modules`
> and `.next` cause heavy sync churn and occasional file locks. Recommended: move the repo to a non-synced folder such as
> `C:\dev\lifequest` (GitHub is the backup for code). Personal data is never stored in the repo either way.

## First-time setup

```powershell
npm install                 # also runs `prisma generate`
npx playwright install chromium webkit
npm run db:migrate          # development database at %LOCALAPPDATA%\LIFEQUEST-development
npm run check               # lint + types + tests + build
```

Optional: copy `.env.example` → `.env.local` and adjust.

## Data sets

| Data set | Folder | Used by |
|---|---|---|
| production | `%LOCALAPPDATA%\LIFEQUEST` | `npm run app:start` / `next start` — your real data |
| development | `%LOCALAPPDATA%\LIFEQUEST-development` | `npm run dev`, `npm run db:*` (default) |
| test | OS temp folders | Vitest and Playwright (isolated, throwaway) |

Each folder contains `db/lifequest.db`, `backups/`, `exports/`, `logs/`, `app.lock` (while running).

## Database workflow

1. Edit `prisma/schema.prisma`.
2. `npm run db:migrate:create -- --name add_budget_table` → creates SQL in `prisma/migrations/` **without** applying it.
3. Review the SQL. Make sure nothing is dropped or truncated unintentionally.
4. `npm run db:migrate` → takes a `pre-migrate` backup, applies migrations, checks integrity.
5. Write/adjust integration tests.

Database CLI (`npm run db -- <cmd>`): `info`, `migrate`, `backup`, `auto-backup`, `list`, `verify <file>`, `restore <file> --yes`, `export`.
Add `--env=production` to act on your real data (Claude is not permitted to do this).

## Git workflow

```
main  ← release PRs only (protected: PR + green CI)
dev   ← default branch; integration
feature/<name>, fix/<name>, chore/<name>  ← branch from dev, PR into dev
```

```powershell
git switch dev; git pull
git switch -c feature/budget-model
# ...work, commit with conventional messages...
git push -u origin feature/budget-model
gh pr create --base dev --fill
```

Commit format: `type(scope): summary` — types `feat, fix, refactor, test, docs, chore, ci, perf, security`.

## Working with Claude Code

- `CLAUDE.md` is loaded automatically; project skills live in `.claude/skills/`.
- Project MCP: `prisma-local` (`.mcp.json`) — development data only.
- User-level plugins: see `docs/TOOLING.md`.
- `.claude/settings.json` denies production data access, `prisma migrate reset` and `db push`, and asks before `git push` and restores.

## Replit

Replit is intentionally **not** used (decided during setup): LIFEQUEST's data must live on your PC, and a cloud workspace
would either hold no real data or become a second, cloud-hosted copy. If you ever want a cloud editor, connect Replit to the
GitHub repo with **demo data only** and never set production credentials there.
