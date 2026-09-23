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
- [ ] ExecPlan updated (`plans/active/v1-final-contract-reconciliation.md` for V1, otherwise `plans/active/<lane>.md`) and `.agent/V1_FINAL_CONTRACT_STATE.md` when the change is a C-gate
- [ ] `/independent-reviewer` reported no material findings

## V1 final contract (C0–C15)

Apply on every reconciliation commit. Authoritative plan: `plans/active/v1-final-contract-reconciliation.md`. State: `.agent/V1_FINAL_CONTRACT_STATE.md`.

- [ ] One coherent gate in the commit; gate ID in the subject; branch `cursor/v1-final-contract-reconciliation-5907`; do not push to `main`
- [ ] Distinguish "implemented in repo" from "deployed and proven on hosted infrastructure"
- [ ] Core translate path still has **no** hard dependency on Supabase, AdMob, RevenueCat, or admin
- [ ] No production secret, tunnel URL, test password (`1234`), service role, or embedded review-sync secret introduced
- [ ] Optional-service failure or session expiry leaves Translate, Camera, History, Settings, and Learn usable
- [ ] Contract matches INTENT: review credits **2** (≤20 original source words) or **4** (≥21); **1 credit = 15 minutes**; rewarded ad = **2 credits**; lookahead minimum **14** / target **28** / append every 14 days; session inactivity **30 days**; interstitial cap **none**; subscription **USD 2.99** (US) / **NPR 199** (Nepal); StoreKit price authoritative; Today's 10 is the only public correction route; 18+ is the contribution gate, not the guest startup gate; automated V1 validation logs a cosine score and returns **PASS**
- [ ] Risky/network feature flags default off until hosted proof
- [ ] No claim of physical-device, hosted-scheduler, model-pass, StoreKit, AdMob, or revenue proof without evidence
- [ ] Human blockers recorded honestly. `FINALIZATION_COMPLETE` is code-owned only
- [ ] Public exposure excludes source and target hashes from train/eval export. Known checks are not copied from gold. Historical migrations and benchmark failures stay intact

## Historical V1-wide gates (R0–R9)

The checklist items below described the R0–R9 program. They are not the living contract. See the C0–C15 section above.

- [ ] Only **one** historical remediation gate was recorded per R-branch
- [ ] `plans/active/v1-testflight-runbook.md` kept its own proof log

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

## Historical production gates (G0–G7 — do not implement)

> These checklists record the 2026-09-22 G0–G7 program. They are not the living contract. Living exit criteria are the C0–C15 section above and `plans/active/v1-final-contract-reconciliation.md`. Boxes below that still say top-50% credits, all corpora eligible, or an 18+ startup gate are that old freeze.

### G0 — product contract freeze (historical)

- [ ] INTENT / V1_G0_DECISIONS / DATA_CLASSIFICATION / AGENTS / DONE / ExecPlan / CERTIFICATION / RELEASE_RUNBOOK describe the corrected V1 boundary
- [ ] Frozen: **global 10 samples/day** at 5:00 PM NY rotation; all training + benchmark corpora eligible; length-tier credits (top-50%-longest = 2, else 1); **1 credit = 15 minutes**; sign-in before purchase/restore/contribution; **startup consent gate (T&C + Privacy + 18+)**; raw speech-media upload **in V1** scope; account-linked collection; 30-day purge on withdrawal/delete; impression-based interstitial timer; TestFlight ads ≠ revenue; soft model-cert ≠ certified
- [ ] Feature flag matrix defaults off; diagnostic internal TF keeps contribution/live ads/paywall off
- [ ] **No runtime code changed**

### G1 — public review pool (global 10/day)

- [ ] `review_source_items` / `review_windows` / `review_submissions` / `review_credits` migrations + RLS
- [ ] Idempotent importer of `datasets/` + `training/` + `benchmarks/` corpora with PII/dedup exclusion reasons and length-percentile snapshot
- [ ] 5:00 PM America/New_York rotation function: close window, grant credits (1/2 by length tier), pre-select next 10 at random, publish
- [ ] Admin adjudication: mark submission `unsatisfactory` before close; late-rejection alert (no clawback)
- [ ] One submission per user per item per window; multiple users per item allowed
- [ ] Backend gate green (or Docker-not-available blocker recorded)

### G2 — startup consent + account-linked deletion

- [ ] Startup consent screen: T&C + Privacy + 18+ checkboxes; blocks product surfaces until all three checked; bilingual; versioned
- [ ] `user_consents` row on sign-in mirrors startup consent; version bump re-shows the screen
- [ ] All optional-service tables (photos, speech media, submissions, corrections, translation contributions) carry `user_id`; guests upload nothing
- [ ] Withdrawal + account-deletion request routes; admin alert; 30-day purge of every row / storage object linked to `user_id`
- [ ] Raw speech capture URI + private-bucket signed upload + retry queue (flag `contribution_speech_enabled` off by default until proven)
- [ ] Privacy Policy + permission strings + Settings copy disclose speech, photo, correction upload behavior

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

F0–F10 checklists remain in git history / `plans/active/beta-release.md` for audit. New V1 work uses **C0–C15** only.

---

## Release go/no-go (public App Store)

> Historical G0–G7 submit list. Public V1 now follows section 9.2 of `plans/active/v1-final-contract-reconciliation.md`. A completed G0–G7 checklist is not the living definition of Done.

The list below is what the G0–G7 program required:

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
