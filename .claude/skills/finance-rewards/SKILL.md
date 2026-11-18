---
name: finance-rewards
description: LIFEQUEST money, budgeting, bank-import and gamification reward logic (XP, levels, achievements, dragon evolution, financial rewards). Use for anything that calculates, grants, imports or displays money or rewards.
---

# Finance & reward logic

## Money
- Store integer **pence**. Format with `Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" })` at the edge only.
- Never use floating-point arithmetic for money. Round once, at the point of allocation (e.g. budget splits), with a remainder rule.
- Imported transactions use the provider transaction ID (or a hash of date, amount, description and account) as an idempotency key, so a re-import never duplicates.
- Categorisation runs locally. Store the rule ID that categorised each transaction (explainability).
- Read-only Open Banking only. No payment initiation, ever.

## Rewards & XP
- Rewards are **events in an append-only ledger**: `{id, idempotencyKey, source, amount/xp, reason, createdAt}`. Levels, totals and dragon stages are **derived**.
- Idempotency keys are deterministic, e.g. `xp:gym-session:<sessionId>` or `reward:budget-kept:<yyyy-mm>`, enforced by a unique index.
- Reward rules are **pure functions** (input facts → grants) in `src/features/quests/server/rules/`, each with unit tests covering boundaries, duplicates and backdated edits.
- Grants are computed server-side on the PC only. The client never sends an XP or amount value.
- Edits that invalidate a reward create a compensating (negative) event rather than deleting the original.
- Every financial or reward grant writes an `AuditEvent` (actor, action, entity, idempotency key) with no sensitive detail.

## Tests required
Duplicate submission, replayed sync push, month boundaries (Europe/London timezone and BST changes), negative and zero amounts, and very large amounts.
