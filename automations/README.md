# Automations

Temporary V1 review validation logs a deterministic local cosine score and **always returns PASS**. A human unsatisfactory mark before the 5:00 PM `America/New_York` close still prevents the reward.

These files document jobs. They are not hosted proof. No secrets belong in this directory.

| Job | Cadence | Source |
|-----|---------|--------|
| Review lookahead | Logical every 14 days via `next_due_at` | `scripts/reviewLookahead.mjs` |
| Review validation | Daily | database close job |
| Deletion reconcile | Every 14 days | deletion state table |
| Deletion execute | At least daily | deletion due query |

TestFlight ads use Google test units and produce no revenue.
