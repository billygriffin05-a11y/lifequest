# LIFEQUEST

Your life, forged into an epic quest — a local-first, dark-fantasy RPG for finance, fitness, nutrition, study, reading and
calendar, with quests, XP and evolving dragons.

**Status:** development environment ready; application features not yet built.

## Principles

- **Your PC owns your data.** Everything is stored in a local SQLite database at `%LOCALAPPDATA%\LIFEQUEST`.
- **Your iPhone syncs privately** with your PC over Tailscale — nothing is exposed to the public internet.
- **No silent cloud.** Any data that leaves your PC is documented in [INTEGRATIONS.md](INTEGRATIONS.md).

## Quick start (Windows)

```powershell
npm install
npm run db:migrate     # creates/updates the development database (with a pre-migrate backup)
npm run dev            # http://127.0.0.1:3000
```

Run for real (your production data): `npm run build` then `npm run app:start`.

## Documentation

| Doc | Purpose |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Rules for Claude Code (and humans) working on the repo |
| [DEVELOPMENT.md](DEVELOPMENT.md) | Setting up, daily workflow, Git branching, database changes |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Local-first design, storage, sync, conflict handling |
| [SECURITY.md](SECURITY.md) | Threat model and security controls |
| [TESTING.md](TESTING.md) | Test strategy and how to run each suite |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Running on your PC and reaching it from your iPhone |
| [INTEGRATIONS.md](INTEGRATIONS.md) | Google Calendar, Open Banking, notifications, recipes |
| [docs/TOOLING.md](docs/TOOLING.md) | Claude Code plugins, skills and MCP servers |
| [docs/SETUP-REPORT.md](docs/SETUP-REPORT.md) | Environment setup status report |
