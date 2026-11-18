---
name: local-database
description: LIFEQUEST SQLite/Prisma database work — schema design, migrations, backups, restore, export and sync-ready tables. Use before touching prisma/schema.prisma, migrations, src/server/db or src/server/backup. (Replaces the Supabase skill — Supabase is not the primary store.)
---

# LIFEQUEST local database

**The user's PC owns the data.** You work only on the **development** data set (`%LOCALAPPDATA%\LIFEQUEST-development`). Never use `--env=production`, never read the production folder, and never run `prisma migrate reset` or `prisma db push`.

## Changing the schema
1. Edit `prisma/schema.prisma`, following the conventions below.
2. `npm run db:migrate:create -- --name <snake_case_change>` (creates the SQL without applying it).
3. **Read the generated SQL.** SQLite table rebuilds (`CREATE TABLE new_...; INSERT INTO ... SELECT`) must copy every column, and nothing may be dropped without a data-preserving plan.
4. `npm run db:migrate` (takes a pre-migrate backup, then applies the migration and checks integrity).
5. Add or adjust integration tests, then run `npm test`.

## Conventions
- `id String @id @default(cuid())`, `createdAt`, `updatedAt @updatedAt`, `deletedAt DateTime?` (soft delete), `version Int @default(1)`, `updatedByDevice String`.
- Money: `Int` pence plus an explicit currency where it isn't GBP. Never use `Float` for money.
- Ledgers (transactions, XP, rewards, workout sets) are append-only. Keep derived totals in views or recomputed caches.
- Idempotency: `idempotencyKey String @unique` on anything imported or retried.
- Index foreign keys and common filters (`@@index([userField, date])`).
- Secrets (OAuth tokens) are stored encrypted, in a column suffixed `Encrypted`.
- Health and finance data must never be added to `AuditEvent.details`. Store IDs and summaries only.

## Tools
- `npm run db:info`, `npm run db:list`, `npm run db -- export`, `npm run db:studio` (development data).
- The Prisma MCP (`prisma-local`) provides `migrate-status`, `migrate-dev` and `Prisma-Studio` on development data. Prefer the npm scripts above for migrations so a backup is taken first.
