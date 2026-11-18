---
name: testing
description: How to test LIFEQUEST — Vitest unit/integration, Playwright e2e and accessibility, isolated data directories, and what "done" means. Use when writing tests or before declaring any change complete.
---

# Testing LIFEQUEST

**Definition of done:** `npm run lint`, `npm run typecheck` and `npm test` pass, plus `npm run build && npm run test:e2e` for UI or routing changes. Report the actual output and never claim a pass you didn't see.

- **Unit tests** (`tests/unit/*.test.ts`) cover pure logic: rules, formatting, validation and parsing.
- **Integration tests** (`tests/integration/*.test.ts`) run against a real SQLite DB: `makeTempDataDir()` + `migrate()` from `tests/support/temp-data-dir.ts`, then `createPrismaClient(paths.dbFile)`. Always disconnect clients (Windows file locks).
- **E2E tests** (`tests/e2e/*.spec.ts`) run in Playwright projects `desktop-chromium` and `iphone-webkit`. Use role-based locators, include an axe scan (`@axe-core/playwright`) for new pages, and check for horizontal overflow at phone width.
- **Never touch real data.** Tests must not rely on `%LOCALAPPDATA%\LIFEQUEST`, and Playwright sets `LIFEQUEST_DATA_DIR` to a temp folder.
- **External APIs:** mock at the HTTP boundary. CI must never call Google, banks or recipe sites.
- **Flaky tests:** fix the cause (await state, use web-first assertions) rather than adding retries or sleeps.
- For new bugs, write a failing test first, then fix.
- Use the Playwright MCP for exploratory checks of the running dev server (`npm run dev` → http://127.0.0.1:3000), then turn findings into committed tests.
