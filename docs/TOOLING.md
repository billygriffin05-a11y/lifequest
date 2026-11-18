# Claude Code tooling for LIFEQUEST

Checked against the Anthropic plugin directory on 2026-11-18. One tool per job — overlapping tools were skipped deliberately.

## Plugins

| Name | Purpose | Source | Maintainer | Status | Permissions / notes |
|---|---|---|---|---|---|
| security-guidance | Pattern warnings on edits, diff review, commit reviewer (injection, XSS, SSRF, secrets…) | Anthropic directory | Anthropic | **Enabled** (pre-existing) | Hooks on edit/stop |
| playwright | Browser automation MCP for exploratory UI testing | Anthropic directory (Microsoft) | Microsoft | **Enabled, verified** — drove the dev server and read the page | Local browser |
| github | Official GitHub MCP (issues, PRs, code search) | Anthropic directory (GitHub) | GitHub | **Enabled but FAILING** — "Authorization header is badly formatted" | Needs re-auth |
| context7 | Up-to-date library docs | Anthropic directory (Upstash) | Upstash | **Enabled, needs sign-in** via `/mcp` | Sends library names/queries to Context7 |
| frontend-design | Distinctive, production-grade UI design guidance | `anthropics/claude-plugins-official` | Anthropic | Recommended — install card offered | Skill only |
| feature-dev | Feature workflow with explorer/architect/reviewer agents | `anthropics/claude-plugins-official` | Anthropic | Recommended — install card offered | Agents only |
| code-simplifier | Refactoring/simplification agent | `anthropics/claude-plugins-official` | Anthropic | Recommended — install card offered | Agent only |
| typescript-lsp | TypeScript language server (go-to-definition, diagnostics) | `anthropics/claude-plugins-official` | Anthropic | Recommended — install card offered | May need `npm i -g typescript-language-server typescript` |
| Superpowers | TDD, systematic debugging, planning, verification-before-completion skills | `obra/superpowers` | Partner (Jesse Vincent) | Recommended — install card offered | "Privileged": adds a SessionStart hook |

**Built in, so no plugin needed:** `/code-review` (correctness and PR review), `/security-review`, `/simplify`, `/init` (CLAUDE.md).

**Deliberately not installed**

| Candidate | Reason |
|---|---|
| Vercel plugin | No Vercel hosting (local-first). Its Next.js skills overlap with the bundled Next 16 docs and Context7. |
| Prisma plugin (directory) | Its remote server targets Prisma Postgres (cloud). The local Prisma MCP is configured per-project instead. |
| Design (knowledge-work) | Bundles nine unrelated connectors (Slack, Gmail, Asana…). Accessibility is covered by axe tests and the `frontend` skill. |
| design-superpowers | Community plugin that overlaps with frontend-design. |
| Supabase MCP | Supabase is not used (see ADR 0001). |
| Vercel MCP | Not used. |
| Figma MCP | No Figma designs exist. Revisit if you start designing in Figma (official Figma Dev Mode MCP). |
| Monitoring / extra security MCPs | No hosted service to monitor. Security is covered by CI (CodeQL, gitleaks, audit) and the security plugin. |

## MCP servers

| Server | Scope | Config | Status | Use |
|---|---|---|---|---|
| prisma-local (`npx prisma mcp`) | Project | `.mcp.json` (pinned to `LIFEQUEST_ENV=development`) | **Verified**: handshake OK; tools `migrate-status`, `migrate-dev`, `Prisma-Studio` | Inspect migration status and open Studio on development data |
| playwright | User plugin | — | **Verified** | Exploratory browser checks of `npm run dev` |
| github | User plugin | — | **FAILED to connect** | Issues, PRs, history once fixed |
| context7 | User plugin | — | **PENDING sign-in** | Library documentation |

Re-test the project MCP at any time with `node scripts/mcp-probe.mjs npx prisma mcp`.

## Project skills (`.claude/skills/`)

`frontend` · `backend-api` · `local-database` · `lifequest-security-review` · `finance-rewards` · `calendar-integration` · `testing` · `deployment`
