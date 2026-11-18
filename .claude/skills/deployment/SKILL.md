---
name: deployment
description: Releasing and running LIFEQUEST on the owner's Windows PC, Tailscale access for the iPhone, release branches, and safe upgrades with backups. Use for release, start-up, Tailscale, scheduled task or CI/CD questions.
---

# Deployment (PC-hosted)

There is no cloud host. Read DEPLOYMENT.md.

- **Release flow:** feature PRs → `dev` → release PR `dev` → `main` (CI must be green) → on the PC: `git pull`, `npm ci`, `npm run build`, `npm run app:start`.
- `app:start` runs `db migrate --env=production`, which **backs up before migrating**. Never bypass it.
- The server binds to 127.0.0.1:3000. The iPhone reaches it through `tailscale serve --bg 3000` plus `LIFEQUEST_ALLOWED_HOSTS`. Never use Funnel or port-forwarding.
- Scheduled backups: `scripts/windows/register-backup-task.ps1`. The user registers it, since this changes their system.
- **Rollback:** check out the previous tag, rebuild, and restore the pre-migrate backup if the schema changed (`npm run db -- restore <file> --yes --env=production`, with the app stopped). This is the user's action because it touches production data.
- Claude must not run production commands, push to `main`, or change Tailscale settings without explicit user instruction.
- Tag releases `vYYYY.MM.N` and summarise changes plus any migration in the PR description.
