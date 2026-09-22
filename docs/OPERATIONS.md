# Production operations (R8)

**Status:** template — every item on this page requires human-owned setup on Supabase, hosting, and third-party consoles. Do not treat this document as evidence that production infrastructure is running. Product boundary: [`.governance/INTENT.md`](../.governance/INTENT.md). Contract freeze: [`.governance/V1_G0_DECISIONS.md`](../.governance/V1_G0_DECISIONS.md). Ship program: [`plans/active/v1-testflight-runbook.md`](../plans/active/v1-testflight-runbook.md).

## Hosted scheduler (5:00 PM America/New_York rotation + 30-day purge)

The `process-scheduled-jobs` Supabase Edge Function does three things:

1. Closes the current NY reward window and grants scheduled contribution credits (`service_close_ny_reward_window`).
2. **R1 (was G1):** rotates the global public-review window (`service_rotate_review_window(p_size, p_as_of)`). Behaviour:
   - Advisory-lock-owned: concurrent invocations return `{status: 'busy'}` and mutate nothing.
   - `not_due`: if the current open window's `ny_close_at > p_as_of`, no mutation; returns `{status: 'not_due', ...}`. Monitoring counts these to confirm the scheduler is alive between 5 PM ticks.
   - At close, grants credit **only** for `confirm` and `edit` submissions that were not marked `unsatisfactory` before close; `skip` and `report` grant zero; `report` also flips the source item to `public_review_eligible=false`. Credits route through `private.apply_reward` so `earned_ad_free_until` advances at close.
   - Empty/under-N pool: opens a window with the actual count and returns `warning: 'pool_short'` (still 200 to the caller).
   - Non-2xx PostgREST response now surfaces to the caller as HTTP 502 `rotate_failed` — cron alerting depends on this instead of the previous "HTTP 200 with `{error: 'rotate_failed'}`" shape that hid failures.
3. Purges eligible account-deletion records (`service_list_deletion_due_users` → `service_purge_scheduled_deletion` → `auth.admin.users delete`).

### Required cron

Exactly one invocation per minute is safe (each RPC is idempotent when re-run before its window closes, and rotation only triggers when a window's `ny_close_at` has passed):

```cron
* * * * *   curl -fsSL -X POST \
              -H "Authorization: Bearer ${CRON_SECRET}" \
              -H "Content-Type: application/json" \
              -d '{}' \
              "${SUPABASE_URL}/functions/v1/process-scheduled-jobs"
```

Supabase Scheduled Functions (cron in `supabase/functions/schedules/*.yaml`) or an external scheduler (Cloudflare Cron Triggers, Render, GCP Cloud Scheduler, etc.) works. **Whatever provider is used must be documented and verified** — the endpoint alone is not evidence that the scheduler runs. Alerting must page on more than one consecutive miss.

### DST correctness

`private.next_review_close(now)` and `private.ny_reward_window_close(ts)` both compute close instants via `AT TIME ZONE 'America/New_York'`, so DST transitions are handled inside Postgres. The scheduler must call the function on wall time — do not hardcode UTC offsets in cron.

### CRON_SECRET

Rotate at least every 90 days. Store in the Supabase Edge Functions secret store (never in the app bundle). The endpoint accepts either `CRON_SECRET` bearer or the service role key.

## Secret matrix

| Secret | Location | Owner | Rotation |
|--------|----------|-------|----------|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project Vault + `functions/secrets` | Supabase admin | On breach or 180 d |
| `CRON_SECRET` | `functions/secrets` | Supabase admin | 90 d |
| `REVENUECAT_WEBHOOK_SECRET` | `functions/secrets` | RC admin | On breach or 180 d |
| `APPLE_SIGNIN_TEAM_ID` / `APPLE_KEY_ID` / `APPLE_PRIVATE_KEY` | Supabase Auth provider | Apple developer | Follow Apple guidance |
| `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` | EAS project env + `app.config.ts` extras | EAS admin | On breach |
| `EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY` (public) | EAS project env | RC admin | On breach |
| `ADMOB_APP_ID` / production ad-unit IDs | EAS project env (public) | AdMob admin | On breach |
| `EXPO_PUBLIC_PRIVACY_POLICY_URL` / `TERMS_OF_SERVICE_URL` / `SUPPORT_URL` / `DELETION_INFO_URL` / `APP_ADS_TXT_URL` | EAS project env | Legal + hosting owner | On URL move |

Client-side envs are considered public and must never carry a service-role key, RC secret key, or webhook secret. The env reader in `mobile/src/config/env.ts` refuses obvious service-role values.

## Feature flags (remote kill switches)

`public.app_config` fields (default off until each gate proves out):

| Flag | Controls | G0–G7 status |
|------|----------|--------------|
| `contribution_text_enabled` | Text / public-review upload | Off until G1 + G2 pass |
| `contribution_speech_enabled` | Post-consent speech upload | Off until G2 native capture URI proof |
| `contribution_photos_enabled` | Post-consent Camera upload | Off until G2 |
| `network_ads_enabled` | Banner requests | Off until G3 device pass |
| `rewarded_ads_enabled` | Rewarded video | Off until G3 device pass |
| `automatic_interstitial_enabled` | Automatic interstitial | Off until G3 + explicit release go/no-go |
| `paywall_enabled` | Subscription purchase / restore | Off until G3 sandbox matrix |
| `telemetry_enabled` | First-party scrubbed telemetry | Off until G5 |
| `deletion_processing_enabled` | 30-day purge job | Off until G2 + G5 |

Flip via `app_config` UPDATE with the service role, or the admin console. Every flag must be reachable without an app update.

## Backups + restore

- Enable Supabase point-in-time recovery (PITR) on the production project.
- Test one restore into a scratch project quarterly. Log the drill in this file.
- Private buckets `contribution-speech` and `contribution-photos` do not restore user data on rollback — do not rely on backups to undo deletion.

## Legal / support URLs

- Privacy Policy, Terms, Support, and Account-Deletion pages must be live on HTTPS **before** external TestFlight.
- `docs/app-ads.txt` must be reachable at `${HOST}/app-ads.txt` and match the AdMob console `app-ads.txt` state.
- Settings falls back to an "honest not-live-yet" state when `EXPO_PUBLIC_*` URLs are empty — do not paste placeholder domains.

## Alerts

Route at least the following to on-call:

- `process-scheduled-jobs` HTTP failure rate > 0 over 15 min
- Contribution / public-review credit grant lag > 30 min after 5:00 PM NY
- Deletion SLA breach (`deletion_due_at < now()` and profile still present)
- RevenueCat webhook processing errors
- AdMob app-ads.txt crawl failures
- Sentry / crash rate > 1 % of sessions

## Verification checklist (before external TestFlight)

- [ ] `process-scheduled-jobs` cron provisioned + monitored (screenshot / dashboard link)
- [ ] `CRON_SECRET` rotated within last 90 days
- [ ] All flags in the table above are `false` in production
- [ ] Backups PITR enabled and last restore drill logged here
- [ ] Privacy / Terms / Support / Deletion / `app-ads.txt` live and matching Settings copy
- [ ] Alert routes tested with a synthetic failure
- [ ] `benchmarks/results/ship_cert_last.json` recorded and reviewed (G4)
- [ ] DEVICE_PROOF filled on the exact TestFlight build (G4/G6)

## Rollback rehearsal

Run before every public submission (see `docs/RELEASE_RUNBOOK.md`):

1. Flip all optional flags to `false`.
2. Verify offline Translate + Camera + Learn still work on device.
3. Ensure no rebuild is required to disable any feature.
4. Log date, operator, and the flag snapshot in the runbook.
