## What & why

<!-- What does this change do, and why? Link the issue if there is one. -->

## How it was tested

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `npm run test:e2e` (UI or routing changes)
- [ ] Checked on a phone-sized viewport (UI changes)

## Data & security checklist

- [ ] No secrets, tokens or personal data committed
- [ ] New tables have a migration created with `npm run db:migrate:create` and reviewed SQL
- [ ] Migration is non-destructive (or the data-preserving plan is described below)
- [ ] Money stored as integer pence; reward/financial writes are idempotent and audited
- [ ] Any new external data flow is documented in INTEGRATIONS.md
