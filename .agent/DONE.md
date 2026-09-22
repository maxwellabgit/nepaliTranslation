# Done is expensive

“I edited the files” is never Done. Use the checklist for **your lane only**.

Shared (every lane that touches `mobile/`):

- [ ] `cd mobile && npm ci`
- [ ] `cd mobile && npm run lint`
- [ ] `cd mobile && npm run typecheck`
- [ ] `cd mobile && npm run test:unit -- --runInBand`
- [ ] `cd mobile && npm run verify:translate` — **mandatory even when the feature seems unrelated**
- [ ] `cd mobile && npx expo-doctor`
- [ ] Prefer `cd mobile && npm run verify:ci` when the slice owns the full mobile gate
- [ ] Diff contains no unrelated files and no gold-reference edits under `benchmarks/gold/`
- [ ] Contributor known checks / seeds were **not** copied from `benchmarks/gold/`
- [ ] ExecPlan updated (`plans/active/<lane>.md` or `plans/active/v1-testflight-finalization.md`)
- [ ] `/independent-reviewer` reported no material findings

## V1-wide gates (TestFlight finalization G0–G7)

Apply on every V1 finalization PR. Gate-specific extras are below.

- [ ] Only **one** V1 gate in the PR; branch name `cursor/v1-gN-short-name-*`
- [ ] `plans/active/v1-testflight-finalization.md` Progress / Commands / Remaining work updated
- [ ] Core translate path still has **no** hard dependency on Supabase, AdMob, RevenueCat, or admin
- [ ] No production secret, tunnel URL, test password (`1234`), service role, or embedded review-sync secret introduced
- [ ] Optional-service failure leaves Translate, Camera, History, Settings, and Learn usable
- [ ] Contract matches INTENT + V1_G0_DECISIONS: $0.99/month; banners idle Translate + Learn only; interstitial **15 min since last successful impression** / ≤3 NY day; rewarded 15 min; credit = 5 min; >20 words = 2 credits; 5 PM America/New_York close; **up to 10** public reviews per reviewer per NY day; no clawback; sign-in before purchase/restore/contribution; speech-media upload **deferred** from V1 disclosures; photo consent + 30-day deletion
- [ ] Feature flags remain independently disableable (text/speech/photo contributions, banners, rewarded, interstitial, paywall, telemetry, deletion processing)
- [ ] No claim of physical-device / airplane-mode / StoreKit / AdMob / interstitial / revenue proof from source-only tests
- [ ] Human blockers (Apple, Supabase, AdMob, RevenueCat, legal, bilingual, device, iPad, hosted cron) recorded honestly when reached
- [ ] Frozen benchmarks not exposed for public correction; known checks not copied from gold

### Standard backend gate (gates that touch `supabase/`)

```text
npx supabase start
npx supabase db reset
npx supabase db lint --level error
npx supabase test db
deno test --allow-env supabase/functions/_shared supabase/functions/tests
```

If Docker cannot run locally, the same gate must run in GitHub Actions and the local limitation must be recorded — do not omit the gate.

### Standard admin gate (gates that touch `admin/`)

- [ ] Unit/Vitest (or equivalent) green
- [ ] Non-admin JWT receives 403 from every admin operation
- [ ] Playwright (or labeled CI) for triage/export/deletion paths when those pages exist
- [ ] No service key in browser code

---

## Lane 1 — eval-integrity

- [ ] Gold schema still valid (`benchmarks/gold/schema.json` + each class `manifest.json`)
- [ ] No training script or docs now tell anyone to train on gold
- [ ] Register mix rejected: informal rows are तिमी-class, formal rows are तपाईं-class (spot-check + any probe you ran)
- [ ] Holdout freeze story still true (see `benchmarks/gold/README.md`)
- [ ] Commands pasted in the ExecPlan

## Lane 2 — ui-bugs

- [ ] Each finding is either **fixed** with a repro note, or **won't-fix** with a device-only blocker
- [ ] Translate, Camera, and Learn: leaving a tab still hard-stops audio (`App.tsx`)
- [ ] Formal / Informal and देवनागरी toggles still match INTENT
- [ ] Loading, empty, error, and “MT not ready” states still exist
- [ ] Independent reviewer walked Translate, Camera, Learn, History, and Settings in source

Honest limit: a cloud agent cannot TestFlight. Do not claim airplane-mode device proof unless a human did it.

## Lane 3 — mt-accuracy

- [ ] `npm run verify:translate` passes
- [ ] Gold references were **not** edited
- [ ] Informal remains तिमी, not तँ
- [ ] Roman input is still normalized before NE→EN where that path exists
- [ ] If gold eval ran: meet or beat frozen baseline, or revert
- [ ] If gold eval could not run: blocker recorded; no quality claim

## Lane 4 — app-runtime

- [ ] Warm-up still does not brick the UI when neural is slow/failing
- [ ] Cancel / hard-stop still stops STT + TTS + in-flight MT
- [ ] Pass-the-phone rules still match `src/translate/passLogic.ts`
- [ ] Phrasebook / fallback path still works when neural is not ready
- [ ] `npx tsc --noEmit` + `npm run verify:translate`

## Lane 5 — model-ship

- [ ] Still one IT2 family; LoRA not `merge_and_unload`
- [ ] INT8-first; gold register/names survive any quant discussion
- [ ] Export path still ends at `mobile/assets/models/` (see `docs/OFFLINE_IOS.md`)
- [ ] Gold eval vs frozen baseline if weights exist; otherwise explicit GPU/artifact blocker
- [ ] No new PC/cloud inference in the product path
- [ ] Release artifacts pinned by revision + SHA-256 when shipping

---

## Production V1 gates (dependency order — do not combine)

### G0 — product contract freeze

- [ ] INTENT / V1_G0_DECISIONS / DATA_CLASSIFICATION / AGENTS / DONE / ExecPlan / CERTIFICATION / RELEASE_RUNBOOK describe the corrected V1 boundary
- [ ] Frozen: up to 10 public reviews per reviewer per NY day; corpus eligibility + benchmark retirement; sign-in before purchase/restore/contribution; speech-media deferred; interstitial = 15 min since last successful impression; TestFlight ads ≠ revenue; soft model-cert ≠ certified
- [ ] Feature flag matrix defaults off; diagnostic internal TF keeps contribution/live ads/paywall off
- [ ] **No runtime code changed**

### G1 — public review pool

- [ ] Source-item / daily-batch / assignment / submission migrations + RLS
- [ ] Idempotent importer with included/excluded counts and reasons
- [ ] Exclusive allocation; global retirement; skip/report/quarantine rules
- [ ] Admin adjudication + inventory/runway; late-rejection alert; 5 PM grant once / no clawback
- [ ] Concurrency + export exclusion tests; DST boundary tests
- [ ] Backend gate green

### G2 — consent / deletion truth

- [ ] Bilingual versioned 18+ consent with evidence fields
- [ ] Withdrawal + account deletion request, admin alert, 30-day purge of **all** linked rows/objects
- [ ] Privacy/permission copy matches photo auto-upload; no false “photos always stay on-device” for consented adults
- [ ] Speech-media either fully proven or absent from disclosures (G0: deferred)
- [ ] Staging lifecycle test or honest blocker

### G3 — monetization repair

- [ ] Rewarded/interstitial wrap real SDK events (v17 `load()` void-safe); contract test vs installed API
- [ ] Interstitial timer = time since last successful impression; safe post-task opportunities; quota after confirmed show
- [ ] Test IDs in TF; prod IDs secret-managed; flags off until readiness
- [ ] Sign-in before paywall/restore; RevenueCat app_user_id = Supabase UUID; CustomerInfo refresh
- [ ] Sandbox matrix recorded or human-gated blocker

### G4 — model + device certification

- [ ] Exact pinned ONNX fetched + hashed; four-class frozen eval results (not soft missing-weights green)
- [ ] Download/resume/corruption/low-storage/offline-restart/fallback exercised or blocked honestly
- [ ] DEVICE_PROOF iPhone + iPad boxes filled for typed, camera/OCR, speech, TTS, UI lang, a11y, rotation, latency/memory/thermal as required

### G5 — production operations

- [ ] Hosted 5 PM credit + 30-day deletion scheduler provisioned, monitored, DST-tested (or concrete infra blocker)
- [ ] Secrets, telemetry, alerts, backups, rate limits, kill switches
- [ ] Live Privacy/Terms/support/deletion/`app-ads.txt` URLs or blockers

### G6 — internal TestFlight candidate

- [ ] Signed build; test ads + sandbox IAP; optional features start off; staged enablement
- [ ] Clean-install / upgrade / reinstall / airplane / denied permission / low storage cases
- [ ] Zero P0/P1; DEVICE_PROOF + rollback rehearsal for this build

### G7 — external TestFlight + V1 decision

- [ ] Small external cohort ≥ seven consecutive stable America/New_York days
- [ ] RELEASE_RUNBOOK go/no-go fully checked; no open P0/P1; revenue/data paths have owners + rollback

---

## Historical F0–F10 (foundation — do not reopen)

F0–F10 checklists remain in git history / `plans/active/beta-release.md` for audit. New work uses **G0–G7** only.

---

## Release go/no-go (public App Store)

Production V1 is Done only when:

- [ ] G0–G7 complete with green CI and independent review where applicable
- [ ] Exact model artifacts pass frozen evaluation and physical-device performance gates
- [ ] iPhone and iPad matrices pass on the same TestFlight build
- [ ] RevenueCat identity bound to Supabase UUID; purchase/restore/refund/reinstall/second-device certified
- [ ] Ads use real SDK contracts; test units in TF; production units gated; app-ads.txt ready before revenue expectation
- [ ] Public-review pool: exclusive up-to-10/day, global retirement, eligibility views, 5 PM grants, late alerts
- [ ] Consent withdrawal + account deletion purge all linked data within 30 days; copy matches behavior
- [ ] Hosted schedulers verified; Privacy/Terms/support URLs live and accurate
- [ ] Bilingual UI and alphabet content receive human sign-off
- [ ] No P0/P1 defects remain and external TestFlight completes seven clean consecutive days
- [ ] Rollback rehearsed using remote flags without disabling the offline core
