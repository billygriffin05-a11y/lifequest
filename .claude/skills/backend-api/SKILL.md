---
name: backend-api
description: LIFEQUEST server code — route handlers, server actions, domain services, validation and error handling. Use when adding or changing anything in src/app/api, src/server or src/features/*/server.
---

# LIFEQUEST backend

- **Layering:** route handler or server action (thin) → Zod-validated input → domain service in `src/features/<domain>/server` → Prisma via `@/server/db/client`.
- Every server module that touches data or secrets starts with `import "server-only";`.
- **Validation:** define Zod schemas in `src/features/<domain>/schemas.ts`, then parse at the boundary and reject unknown keys (`.strict()`).
- **Errors:** return typed results. Map expected errors to 400/404/409. Log unexpected errors with an error ID only, never with the payload.
- **Auth (once the pairing phase lands):** every mutating route checks the session or device token and the Origin header. Never trust client-supplied user, device or amount fields.
- **Caching:** Next 16 Cache Components. Call `await connection()` in handlers that read per-request data, and never cache personal data across users or devices.
- **Idempotency:** mutations that can be retried (sync push, imports, rewards) take an idempotency key backed by a unique index.
- **Cross-domain effects** go through `src/server/events` functions, never direct writes into another domain's tables.
- **Verify:** add unit tests for services and integration tests against a temp DB (`tests/support/temp-data-dir.ts`).
