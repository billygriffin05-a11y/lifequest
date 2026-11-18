# CLAUDE.md — LIFEQUEST

Read this file before making any change. It is the contract for how work is done in this repository.

@AGENTS.md

## 1. What LIFEQUEST is

A cross-platform personal life-management app that feels like a **premium dark-fantasy RPG**, not a productivity dashboard. Domains:
finance & monthly budgets · gym, running & fitness · nutrition, meal plans & genuine recipes · calendar & notifications ·
cybersecurity education & CompTIA Security+ prep · reading & personal development · gamification (quests, XP, levels,
achievements, evolving dragons).

**Single user, local-first.** The owner's **Windows PC is the primary, authoritative owner of all data.**
The iPhone is a synchronised replica. Cloud services must never silently become the permanent store or a single point of failure.

## 2. Current phase

Environment setup is complete. Built so far:
- **Honour** (`src/features/honour`, `/honour`): customisable good/bad actions, append-only Honour/XP ledger with undo.
- **Honour chart**: good vs bad daily line chart (7/30/90 days) on `/honour`.
- **Dragons** (`src/features/dragons`, `/dragons`, `/dragons/gallery`): one **elemental** dragon per life area (Fire,
  Earth, Lightning, Plasma, Water, Ice, Air, Shadow), **20 stages** from that area's XP, mood from the area's
  last-7-days Honour. Medieval look; each element has its own breath attack. Art is **procedural pixel art in code**
  (`sprite.ts`, layered + CSS-animated, off under reduced motion) — Codex image generation was not available on the
  owner's account. Keep this approach unless the owner asks otherwise.

Do not start other domains (finance, fitness, nutrition, etc.) unless the user has started that phase.

## 3. Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, `cacheComponents`), React 19, TypeScript (strict) |
| Styling | Tailwind CSS v4 with LIFEQUEST tokens in `src/app/globals.css` |
| Database | **SQLite** on the PC via **Prisma 7** + `@prisma/adapter-better-sqlite3` |
| Server | `next start` on the PC, bound to **127.0.0.1** only |
| Remote access | **Tailscale Serve** (HTTPS, tailnet-only) — never port-forwarding |
| Validation | Zod |
| Tests | Vitest (unit/integration), Playwright + axe (e2e/a11y) |
| CI | GitHub Actions (lint, types, tests, build, e2e, audit, gitleaks, CodeQL) |
| Package manager | npm (with `allowScripts` allow-list in package.json) |

Supabase, Vercel and Replit are **not** used. Supabase may only ever become an *optional, end-to-end-encrypted sync relay* with the user's explicit approval.

> **Next.js 16 has breaking changes vs. older training data** (`middleware` → `proxy`, Cache Components, typed `LayoutProps`, etc.).
> Before writing Next.js code, read the relevant guide in `node_modules/next/dist/docs/`. Use Context7 for other libraries.

## 4. Architecture map

```
src/
  app/                 Routes (UI + route handlers). Keep thin.
  proxy.ts             Host allow-list (DNS-rebinding protection). Runs on every request.
  instrumentation.ts   Loads src/server/startup.ts on the Node runtime.
  server/              Server-only code. Never import from client components.
    config/paths.ts    Data directory resolution (also used by prisma.config.ts and scripts — no Next imports here)
    config/settings.ts Zod-validated env config
    db/client.ts       Prisma singleton ("server-only")
    db/factory.ts      createPrismaClient(dbFile) — used by tests
    backup/backup.ts   Backup / verify / restore / export / auto-backup
    startup.ts         Data dir checks, app lock file, automatic backups
  generated/prisma/    Generated Prisma client (git-ignored; created by `postinstall`)
prisma/                schema.prisma + migrations (committed)
scripts/db.ts          Database CLI (info, migrate, backup, list, verify, restore, export)
tests/{unit,integration,e2e}/
.claude/skills/        Project skills — load the relevant one before working in that area
```

Planned feature layout (when features start): `src/features/<domain>/{components,server,schemas,tests}` — one folder per domain
(`finance`, `fitness`, `nutrition`, `calendar`, `study`, `reading`, `quests`, `dragons`). Shared UI in `src/components/ui`.

## 5. Working rules (always)

1. **Inspect before changing.** Read the existing code and the relevant skill in `.claude/skills/` first.
2. **No unnecessary rewrites.** Make the smallest change that solves the problem; reuse existing components and helpers.
3. **Keep features modular.** A domain must not reach into another domain's internals; share via `src/server` or `src/components`.
4. **Explain significant architectural decisions** (new dependency, new table, new external service, sync changes) before implementing, and record them in `docs/adr/`.
5. **Test before declaring done.** Run `npm run lint`, `npm run typecheck`, `npm test` and — for UI/routing — `npm run build && npm run test:e2e`.
6. **Never invent results.** Never claim an integration works, a test passes, or a deployment succeeded unless you ran it and saw it. Report failures with the output.
7. Use British English in UI copy (budget, colour, programme).

## 6. Data & database rules

- Data lives in `%LOCALAPPDATA%\LIFEQUEST` (production) / `LIFEQUEST-development` / `LIFEQUEST-test`. **Never inside the repo, `public/`, or OneDrive.**
- Claude works on the **development** data set only. Never run commands with `--env=production`, never read/edit the production data folder.
- Schema changes: edit `prisma/schema.prisma` → `npm run db:migrate:create -- --name <change>` → **review the SQL** → `npm run db:migrate`
  (which takes a pre-migrate backup). **Never** use `prisma migrate reset`, `prisma db push`, or hand-edit applied migrations.
- Migrations must be non-destructive. Renames/drops need a data-preserving multi-step migration and an explicit note in the PR.
- Syncable tables include: `id` (cuid), `createdAt`, `updatedAt`, `deletedAt` (soft delete), `version` (Int), `updatedByDevice`.
- **Money = integer pence** (`Int`), never Float. Currency is GBP unless a column says otherwise.
- Financial and reward events are **append-only ledgers** with **idempotency keys** and an `AuditEvent`. Balances/XP are derived, not overwritten.
- Never store bank passwords. OAuth tokens are encrypted at rest (AES-256-GCM, key outside the DB).

## 7. Security rules (non-negotiable)

- Never commit secrets. Only `.env.example` is tracked. Don't print env values in logs or chat.
- Server-only code imports `server-only`. Secrets never use the `NEXT_PUBLIC_` prefix.
- Validate all input at the boundary with Zod; parameterise SQL (Prisma / prepared statements only).
- Logs: no personal data, tokens, amounts tied to merchants, or health data — log IDs, counts and status.
- Server binds to 127.0.0.1. Remote access only via Tailscale Serve with `LIFEQUEST_ALLOWED_HOSTS`. Never suggest port-forwarding or `-H 0.0.0.0`.
- Any new outbound data flow (third-party API) must be documented in INTEGRATIONS.md §"Data leaving the PC" and approved by the user.
- Use real development/sandbox credentials only; never connect real bank accounts during development.
- Run `/security-review` on changes touching auth, sync, finance, tokens, or file paths.

## 8. Design standards

Dark obsidian backgrounds; **emerald** (progress/success), **gold** (rewards, headings, premium), **silver** (body text, secondary).
Display font Cinzel, body Inter (self-hosted via `next/font`). Use the theme tokens (`bg-obsidian-900`, `text-gold-300`, …) — no raw hex in components.
Mobile-first; must work on iPhone (safe areas, 44px touch targets) and Windows desktop. WCAG 2.1 AA contrast; keyboard accessible;
respect `prefers-reduced-motion`. Animations: transform/opacity only. Load the `frontend` skill for UI work.

## 9. Git workflow

- `main` = stable releases (protected; PR + green CI required). `dev` = integration branch (default).
- Branch from `dev`: `feature/<short-name>`, `fix/<short-name>`, `chore/<short-name>`. PR into `dev`; release PR `dev` → `main`.
- Conventional commits: `feat(finance): add monthly budget model`, `fix(sync): …`, `chore(deps): …`, `docs: …`, `test: …`.
- Never force-push `main`/`dev`. Never commit generated files, `.env*` (except example), or `*.db`.

## 10. Integrations & deployment

See INTEGRATIONS.md and DEPLOYMENT.md. Summary: Google Calendar (OAuth, local mirror), Open Banking via an FCA-regulated
provider (read-only, sandbox first), Web Push notifications, recipes saved with publisher + URL (never fabricated).
Deployment = the user's PC running `npm run app:start`, reached from the iPhone via Tailscale Serve.

## 11. Useful commands

```
npm run dev            # dev server on http://127.0.0.1:3000 (development data)
npm run check          # lint + typecheck + tests + build
npm run test:e2e       # Playwright (needs `npm run build` first)
npm run db:info        # where the DB is, integrity, migrations
npm run db:backup      # manual backup (development data set)
```
