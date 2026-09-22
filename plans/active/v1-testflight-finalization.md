# v1-testflight-finalization: Gate G0–G7 ship readiness

## Goal
Make NepTranslate honestly ready for external TestFlight and then V1 — fixing audit blockers in review-pool contract, consent/deletion, monetization SDK/identity, model/device certification, and production ops — without breaking offline guest Translate, Camera, History, Settings, or Learn.

## Context (paths, commands, constraints)

- **Audit tip:** `43f9bc6` (2026-09-22). F0–F10 source merged; **not** external RC.
- **Contract freeze:** `.governance/V1_G0_DECISIONS.md`, `.governance/DATA_CLASSIFICATION.md`, `.governance/INTENT.md`.
- **Branch policy:** exactly one gate per branch/PR: `cursor/v1-gN-short-name-5907`.
- **Operating protocol:** `AGENTS.md`, `.agent/LOOP.md`, `.agent/DONE.md`, this ExecPlan.
- **Protected:** `mobile/src/mt/`, `mobile/src/stt/`, translation verify scripts, Expo SDK 57. `benchmarks/gold/` reference answers are read-only in code; V1 imports them into the review pool via a **copy** into `review_source_items` (never edits gold in place).
- **Prohibited:** invent device/TestFlight/revenue results; claw back credits; guest purchase/restore; auto-promote review submissions back into `benchmarks/gold/` or training corpora.
- **Prior program:** `plans/active/beta-release.md` (F0–F10) is **foundation / closed as ship program**. Do not reopen F-slices.

## Done when (copy the lane checklist from DONE.md)

V1-wide + current-gate checklist in `.agent/DONE.md`. G0 specifically: durable docs only; no runtime code; a fresh session can state review cardinality (**global 10/day, 5 PM NY rotation**), corpus rules (**all training + benchmarks eligible**), credit rule (**1 credit = 15 minutes; top-50%-longest = 2**), sign-in-before-purchase, startup consent gate (T&C + Privacy + 18+), raw speech-media **in V1**, interstitial impression timer, and that `43f9bc6` is not external RC.

## Milestones

- [x] **G0** — Freeze corrected product contract (docs only) — amended per owner directive; committed on `cursor/v1-g0-contract-freeze-5907`; PR open blocker
- [x] **G1** — Global 10/day public-review pool schema, importer of all corpora, 5 PM rotation, admin adjudication — committed on `cursor/v1-g1-review-pool-5907`
- [x] **G2** — Startup consent gate, account-linked speech/photo upload, withdrawal, 30-day purge — committed on `cursor/v1-g2-consent-deletion-5907`
- [x] **G3** — Ads SDK event contracts, impression-based interstitial timer, RevenueCat↔Supabase identity — committed on `cursor/v1-g3-monetization-5907`
- [ ] **G4** — Exact ONNX hash + four-class eval; DEVICE_PROOF physical evidence — cert run 2026-09-22 FAIL (formal + informal EN→NE below floors); committed on `cursor/v1-g4-model-device-5907`
- [ ] **G5** — Hosted scheduler proof, secrets, legal URLs, alerts, backups, kill switches
- [ ] **G6** — Internal TestFlight candidate; staged remote flag enablement; zero open P0/P1 for enabled surfaces
- [ ] **G7** — External cohort ≥ seven stable NY days; signed go/no-go

## Progress

**Current: G4 — model certification against exact pinned ONNX weights**

| Area | Change |
|------|--------|
| Weights fetched | `huggingface_hub.snapshot_download` pulled `hari31416/indictrans2-en-indic-dist-200M-ONNX-int8` @ manifest revision + `hari31416/indictrans2-indic-en-dist-200M-ONNX-int8` @ manifest revision into `mobile/assets/models/it2_en_indic` and `mobile/assets/models/it2_indic_en` (gitignored). |
| Cert run | `python benchmarks/certify_ship_artifacts.py` produced real chrF and register rates on frozen gold. Result committed: `benchmarks/results/ship_cert_last.json` (`passed=false`). |
| Verdict | `en_ne_formal` 0.4468 vs 0.55, `en_ne_informal` 0.4440 vs 0.50 — BOTH fail. Register floors also miss: तपाईं 0.7% (floor 15%), तिमी 0.0% (floor 10%). `ne_en_deva` 0.6111 PASS. `ne_en_roman` 0.4248 PASS. |
| Docs | `docs/MODEL_CERT.md` records the measured 2026-09-22 numbers and lists the register-lift work as an out-of-G4 blocker (belongs to `model-ship` / `mt-accuracy`, not this gate). |

**Prior: G3 — monetization repair (ads SDK contracts + RevenueCat identity)**

| Area | Change |
|------|--------|
| Ads SDK contract | `AdService.ts` rewritten around v17 `load()`/`show()` = void. Attach LOADED + ERROR + CLOSED (+ IMPRESSION when present) event listeners before calling load/show; never chain `.catch()` onto a void return. `loadInterstitial` rejects on ERROR; `showInterstitial` returns `{ impression: boolean }`. `loadRewarded` / `showRewarded` follow the same pattern with EARNED_REWARD. |
| Contract test | `AdService.voidLoadContract-test.ts` mocks a void-returning `load()`/`show()` and verifies load resolve/reject, impression=true only after IMPRESSION+CLOSED, impression=false on ERROR, and rewarded earned semantics. |
| Impression timer | `foregroundAdTimer.ts` adds `resetForegroundActiveMs()`. `tryPresentInterstitial` only records daily count and resets the timer after a confirmed impression; a failed show returns `{ presented: false, executed: 'none:no_impression' }` and leaves the "minutes since last impression" counter untouched. |
| Interstitial tests | `interstitial-test.ts` gains coverage: impression resets timer to 0; SDK reporting no impression leaves timer and daily count untouched. |
| RevenueCat identity | `PurchaseService.ts` gets an `identify(userId)` method. Production service configures RC without an appUserID by default, then binds identity via `configure({apiKey, appUserID})` or `logIn(userId)` on `identify`. `purchase()` and `restore()` reject with `sign_in_required` when identity is not bound. `refresh(userId)` also refreshes `getCustomerInfo` from RC. |
| Subscription provider | `openPaywall()` refuses to open when user is not signed in. |
| PurchaseService tests | Native-adapter test suite verifies pre-identify rejection, identify binding, refresh identify, offering + purchase + restore, and cache. |

**Prior: G2 — startup consent gate + account-linked collection**

| Area | Change |
|------|--------|
| Migration | `supabase/migrations/20260922110000_g2_startup_consent.sql` — `startup_consent_version` in `app_config`; `startup_*` fields on `profiles`; `service_record_startup_consent` RPC (rejects incomplete + outdated); `service_current_startup_consent_version` view fn; `private.purge_user_data` extended to remove `review_submissions` and `contributor_alerts` |
| pgTAP | `supabase/tests/17_g2_startup_consent.test.sql` — incomplete/outdated rejection, complete acknowledgement, review-submission purge on account deletion |
| Mobile storage | `mobile/src/storage/startupConsent.ts` + tests — device-local record; version-aware `isStartupConsentCurrent` |
| Mobile gate | `mobile/src/features/auth/StartupConsentGate.tsx` — bilingual full-screen gate wrapping AppProviders; blocks product surfaces until Terms + Privacy + 18+ checkboxes accepted |
| Consent mirror | `mobile/src/features/auth/recordStartupConsent.ts` + tests — POSTs to `service_record_startup_consent` when signed in |
| Speech contribution | `mobile/src/features/contribution/enqueueSpeechContribution.ts` + tests — enforces startup gate + media consent + `contribution_speech_enabled` before enqueueing speech media |
| i18n | New bilingual strings for the startup gate in `en.ts`/`ne.ts` |
| Wiring | `AppProviders` + `App.tsx` accept `bypassStartupConsent` seam; production boot enforces the gate; three existing tests pass `bypassStartupConsent` |

**Prior: G1 — global 10/day public-review pool (backend + client)**

| Area | Change |
|------|--------|
| Migration | `supabase/migrations/20260922100000_g1_public_review_pool.sql` — `private.review_source_items`, `public.review_windows`, `review_window_items`, `review_submissions`, `private.review_admin_actions`, view `public.review_current_window`, importer + rotation + submit + admin RPCs |
| Credit ratio | `supabase/migrations/20260922100500_g1_credit_ratio_15_minutes.sql` — `apply_reward` forces 1 credit = 15 min; `reward_schedule` updated (rewarded_video → 1 credit / 15 min; new `public_review`/`public_review_long` kinds) |
| pgTAP | `supabase/tests/16_g1_review_pool.test.sql` — tier snapshot, rotation, dedupe, admin unsatisfactory, credit grant at close, late-reject alert without clawback, sign-in guard |
| Rotation cron | `supabase/functions/process-scheduled-jobs/index.ts` calls `service_rotate_review_window` alongside NY reward close |
| Public API | `supabase/functions/public-review/index.ts` — `{op:"current"}` returns shared window; `{op:"submit"}` records a review (auth required) |
| Importer | `supabase/scripts/import_review_pool.ts` — walks `training/`, `datasets/`, `benchmarks/` JSONL, hashes rows, calls `service_import_review_item`, then refreshes length tiers |
| Mobile client | `mobile/src/features/contribution/publicReviewApi.ts` + `__tests__/publicReviewApi-test.ts` — global-10 contract, credit tier labels |

**Prior: G0 amended — contract freeze (docs only)**

| Area | Change |
|------|--------|
| Decisions | `.governance/V1_G0_DECISIONS.md` amended: D1 global 10/day + 5 PM rotation; D2 all corpora eligible + length-percentile tier; D4 startup consent gate + speech in V1; D6 1 credit = 15 min |
| Data classes | `.governance/DATA_CLASSIFICATION.md` — training + benchmark rows all eligible for review; submissions never re-enter training/eval without a separate verification |
| INTENT / AGENTS / DONE | Aligned to amended freeze |
| ExecPlans | This file active; `beta-release.md` foundation-only |
| CERTIFICATION / RELEASE_RUNBOOK | Updated |

## Surprises & discoveries

- Audit: `react-native-google-mobile-ads` v17 `load()` returns `void`; app `.catch` throws (fix in G3).
- Soft ship-cert CI can be green with missing ONNX weights — must not be treated as G4 Done.
- Owner directive reversed prior per-reviewer + benchmark-retirement decisions.

## Decision log

- 2026-09-22: **G0 first freeze** — up to 10 per reviewer per NY day; benchmark retirement; speech deferred; 1 credit = 5 min; >20 words → 2 credits.
- 2026-09-22 (later): **G0 amended per owner directive.**
  - Public review is **global 10 items/day**, all users see the same set.
  - Rotation at **5:00 PM America/New_York**: close, grant credits, pick new 10 at random.
  - Import **all** `datasets/` + `training/` + `benchmarks/` rows as `public_review_eligible=true` after PII/dedup; **do not** promote submissions back into training/eval without a separate verified migration.
  - Length-tier credits: top 50% of `source_char_length_rank` at assignment → 2 credits; else 1 credit.
  - **1 credit = 15 minutes** ad-free. Rewarded video = 1 credit.
  - **Startup consent gate** required for every user: T&C + Privacy Policy + "I am 18+" checkboxes; blocks product surfaces until all three checked.
  - **Raw speech-media upload is in V1**; disclosed in Privacy Policy; account-linked; 30-day purge on withdrawal / deletion.

## Commands that actually ran (paste)

```text
git fetch origin && git pull origin main   # 43f9bc6
git checkout -b cursor/v1-g0-contract-freeze-5907
# G0 first freeze commit
# Independent review FAIL on DEVICE_PROOF speech line → fix commit
# Owner directive → G0 amended (this commit)
```

## Remaining work

1. Full mobile Review UI (screen wiring, i18n keys) using `publicReviewApi.ts` — deferred to G6 internal-TF build so it lands with the staged flag enablement.
2. Corpus importer must run against the target Supabase project (needs `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`) — record blocker for G5 ops.
3. Native STT recorder → durable audio URI wiring so `enqueueSpeechContribution` gets real bytes (STT/recorder platform work; blocker for G4 device).
4. **G3** on branch `cursor/v1-g3-monetization-5907`: rewrite `AdService` around real SDK events, impression-based interstitial timer, RevenueCat identity, CustomerInfo refresh.
5. **G4** on branch `cursor/v1-g4-model-device-5907`: attempt exact ONNX fetch + hash + four-class eval; on missing weights, record concrete blocker.
6. **G5** on branch `cursor/v1-g5-ops-5907`: hosted scheduler cron for 5 PM rotation + 30-day purge; secrets/kill switches/legal URLs blockers.
7. Independent review of G0 + G1 in fresh contexts.

## Blockers (concrete; cannot be solved from this repo)

- Exact ONNX weights under `mobile/assets/models/` for four-class eval (G4)
- Physical iPhone/iPad proof (G4/G6)
- Production Supabase cron / scheduler provisioning and monitoring (G5)
- Live Privacy/Terms/support/deletion/`app-ads.txt` hosting (G5)
- App Store Connect + RevenueCat + AdMob production configuration (G3/G5)
- Legal review of bilingual startup consent + Privacy Policy before live collection (G2)
- Docker Desktop not available on this agent host → `supabase db reset` / pgTAP for G1 run in CI, not locally
- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` for target project to run `deno run supabase/scripts/import_review_pool.ts` against the eligible corpus
- `ManagePullRequest` create failed with GitHub `must be a collaborator` — branches are pushed; human must open PRs
