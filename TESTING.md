# Testing

| Layer | Tool | Location | Command |
|---|---|---|---|
| Unit | Vitest | `tests/unit` | `npm test` |
| Integration (real SQLite + real migrations) | Vitest | `tests/integration` | `npm test` |
| End-to-end | Playwright (desktop Chromium + iPhone 15 WebKit profile) | `tests/e2e` | `npm run build && npm run test:e2e` |
| Accessibility | axe-core via Playwright (WCAG 2.1 A/AA) | `tests/e2e` | same |
| Security | Host allow-list, header & config tests; gitleaks, npm audit, CodeQL in CI | tests + CI | — |
| Coverage | v8 | `coverage/` | `npm run test:coverage` |

## Isolation rule

Tests **never** touch real data. Integration tests create a temp data dir (`tests/support/temp-data-dir.ts`) and apply the
real Prisma migrations to it. Playwright starts `next start` with `LIFEQUEST_DATA_DIR` set to a temp folder.

## Current suites (environment phase)

- `paths.test.ts` — data dir resolution, env separation, refusal of in-repo data dirs, cloud-folder warning.
- `settings.test.ts` — config validation (no value leakage), Host allow-list parsing.
- `local-storage.test.ts` — storage acceptance tests: persistence across restarts, backup/verify/restore, tamper detection,
  path-traversal refusal, restore-while-running refusal, retention policy, JSON export, idempotency keys.
- `smoke.spec.ts` — shell renders, axe a11y, no horizontal scroll on iPhone viewport, health endpoint, PWA manifest,
  security headers, no external network requests, unknown Host refused.

## To add as features arrive

- **Auth/device pairing:** pairing code expiry, token revocation, unauthenticated access refused.
- **Sync:** property-based tests for merge/conflict rules; offline outbox replay; idempotent retries.
- **Finance/rewards:** pure-function tests for reward rules, pence arithmetic, duplicate-grant prevention.
- **API:** route-handler tests with Zod schema rejection cases.
- **Database permissions:** since SQLite has no roles, "permission tests" = proving every API route enforces auth and device scope.

Note: Playwright's WebKit on Windows approximates iPhone Safari; it is not a substitute for testing on the real device.
