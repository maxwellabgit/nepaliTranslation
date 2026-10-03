# Supabase Scheduled Functions (G5)

Templates for the hosted scheduler that drives:

- Shared-contribution deletion within 30 days, with storage removed before database rows. Private identity and credits survive.
- Historical full-identity deletion, including Auth removal only for that request kind.
- Public-review rotation and contribution-credit close are retired. No reward RPC runs in this worker.

## Files

| File | Purpose |
|------|---------|
| `process-scheduled-jobs.yaml` | Every-minute POST to `functions/v1/process-scheduled-jobs`. Idempotent per invocation. |

## Human setup

1. Import this file into Supabase Scheduled Functions (or the chosen alternative — Cloudflare Cron, Render, GCP Cloud Scheduler, etc.).
2. Bind `CRON_SECRET` in the Edge Functions secret store; rotate every 90 days.
3. Paste the resulting dashboard link into `docs/OPERATIONS.md` before external TestFlight.
4. Verify an actual deletion purge and confirm no review/reward rotation is scheduled before enabling optional collection.

Nothing in this directory replaces the human verification checklist in `docs/OPERATIONS.md`. An agent must not claim the scheduler is running just because these files exist.
