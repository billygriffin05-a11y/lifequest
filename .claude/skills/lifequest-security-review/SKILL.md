---
name: lifequest-security-review
description: LIFEQUEST-specific security checklist for changes touching auth, device pairing, sync, finance, rewards, tokens, file paths, external APIs or logging. Use alongside the built-in /security-review before merging such changes.
---

# LIFEQUEST security review

Run the built-in `/security-review` first, then check each item below against the diff.

**Exposure**
- [ ] The server still binds to 127.0.0.1. No `0.0.0.0`, no Tailscale Funnel, no port-forwarding instructions.
- [ ] New routes are covered by `src/proxy.ts`, and mutating routes check auth and Origin.

**Secrets & data**
- [ ] No secrets in code, tests, fixtures, logs or docs. No `NEXT_PUBLIC_` prefix on secrets.
- [ ] Modules that handle secrets import `server-only`.
- [ ] Logs contain no personal, financial, health or token data.
- [ ] OAuth tokens are encrypted at rest. Bank credentials are never stored. No payment initiation.
- [ ] Any new outbound data flow is documented in INTEGRATIONS.md and approved by the user.

**Input & files (OWASP)**
- [ ] All input is Zod-validated. Prisma or prepared statements only, and any raw SQL is parameterised.
- [ ] File paths come from `getDataPaths()`. User input never builds paths (no traversal).
- [ ] Output is safe from XSS (no `dangerouslySetInnerHTML` with external content, e.g. imported recipes).
- [ ] SSRF: recipe and other URL fetching uses an allow-listed scheme (https), blocks private IP ranges, and has size and time limits.

**Integrity**
- [ ] Financial and reward writes are append-only, use idempotency keys, compute amounts server-side and write an `AuditEvent`.
- [ ] Sync handles replays idempotently, and conflicts are recorded, not silently overwritten.
- [ ] Migrations are non-destructive, and backup and restore paths are unchanged or tested.

**Dependencies**
- [ ] Any new package is justified, maintained and has no high or critical `npm audit` findings. Add it to `allowScripts` only if its install script is needed and trusted.
