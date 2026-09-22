# Supabase Scheduled Functions (G5)

Templates for the hosted scheduler that drives:

- The 5:00 PM America/New_York contribution-credit close (`service_close_ny_reward_window`).
- The global public-review 10/day rotation (`service_rotate_review_window`).
- The 30-day account-deletion purge (`service_list_deletion_due_users` → `service_purge_scheduled_deletion` → auth admin delete).

## Files

| File | Purpose |
|------|---------|
| `process-scheduled-jobs.yaml` | Every-minute POST to `functions/v1/process-scheduled-jobs`. Idempotent per invocation. |

## Human setup

1. Import this file into Supabase Scheduled Functions (or the chosen alternative — Cloudflare Cron, Render, GCP Cloud Scheduler, etc.).
2. Bind `CRON_SECRET` in the Edge Functions secret store; rotate every 90 days.
3. Paste the resulting dashboard link into `docs/OPERATIONS.md` before external TestFlight.
4. Verify at least one clean 5:00 PM America/New_York rotation and one deletion purge under staging before flipping any production flag.

Nothing in this directory replaces the human verification checklist in `docs/OPERATIONS.md`. An agent must not claim the scheduler is running just because these files exist.
