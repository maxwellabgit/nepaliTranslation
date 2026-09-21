# beta-release: App Store / TestFlight release candidate program

## Goal
Ship an iOS external TestFlight beta, then a public App Store release candidate, without breaking offline EN↔NE translation. Core translate, Camera, History, Settings, and Learn stay usable without login; Supabase / ads / subscription are optional services that must fail soft.

## Context (paths, commands, constraints)

- **Baseline:** `main` at `43f14b0adc2dd596f9eb64bc79aea2bece5d9406` (2026-09-19).
- **Branch policy (hardening):** work on **`main`** until H0–H6 pass. PR #2 is foundation only — not merge-as-beta-ready until hardening gates pass.
- **Branch naming (Slice 09+):** `cursor/beta-XX-short-name` (one slice per branch / PR).
- **Product contract:** `.governance/INTENT.md` (offline core + optional online services).
- **Operating protocol:** `AGENTS.md`, `.agent/LOOP.md`, `.agent/DONE.md`, this ExecPlan.
- **Source plan:** founder App Store beta implementation plan (slices 00–13) + PR #2 hardening plan (H0–H6).
- **Protected:** `mobile/src/mt/`, `mobile/src/stt/`, translation verify scripts, Expo SDK 57. No model-family change; no cloud translation.
- **Prohibited files / data:** never edit or copy contributor known-check answers from `benchmarks/gold/` (or any private holdout / training eval answers). Known checks are a separate curated seed under backend/admin data only.
- **Former release blockers (removed in Slice 04):** embedded review-sync URL/secret and Meaning Review password `1234` are gone from the production path.

### Baseline proof (recorded 2026-09-19 on clean tree at baseline)

```text
cd mobile
node ./scripts/export_meaning_lexicon.mjs
npx tsc --noEmit
npm run verify:translate
```

Re-run after `npm ci` when `node_modules` is incomplete. `verify:translate` is mandatory on every mobile-changing PR even when the feature seems unrelated.

## Done when (copy the lane checklist from DONE.md)

Beta-wide + current-slice checklist in `.agent/DONE.md`. Slice 00 specifically: durable docs only; no runtime code changed; another fresh session can state target, current slice, tests, and prohibited files without chat history.

## Milestones

### Slices 00–08 (foundation on main; integration acceptance pending)

- [x] Slice 00 — Product contract and release lane — foundation implemented; integration acceptance pending
- [x] Slice 01 — Test harness and UI primitives — foundation implemented; integration acceptance pending
- [x] Slice 02 — Supabase schema, RLS, and API skeleton — foundation implemented; integration acceptance pending
- [x] Slice 03 — Sign in with Apple, consent, and deletion — foundation implemented; integration acceptance pending
- [x] Slice 04 — Unified correction sheet and offline outbox — foundation implemented; integration acceptance pending
- [x] Slice 05 — Contribution queue, hidden checks, and consensus — foundation implemented; integration acceptance pending
- [x] Slice 06 — Reward ledger and entitlement service — foundation implemented; integration acceptance pending
- [x] Slice 07 — Learn alphabet — foundation implemented; integration acceptance pending
- [x] Slice 08 — AdMob adapter and ad middleware — foundation implemented; integration acceptance pending (native AdMob not proven)

### PR #2 foundation hardening (work on `main`)

- [x] H0 — Truthful, reproducible gates (independent review PASS)
- [x] H1 — Production-composition integration harness (independent review PASS; landed with H2 tip)
- [x] H2 — Correction metadata and reliable offline outbox (independent review PASS)
- [x] H3 — Atomic server-side consent, consensus, receipts, multi-user rewards (independent review PASS; backend CI green)
- [x] H4 — Apple identity/deletion + remove founder-only UI (independent review PASS; device Apple human-gated)
- [x] H5 — Learn, reward visibility, accessibility, UI consistency (independent review PASS; bilingual sign-off human-gated)
- [x] H6 — Real AdMob + cryptographically verified SSV (independent review PASS; device AdMob human-gated; ads flags off)
- [ ] Merge foundation — honesty gate repaired; merge when founder accepts named human gates below

### Later slices (separate PRs after foundation)

- [ ] Slice 09 — StoreKit subscription through RevenueCat
- [ ] Slice 10 — Protected admin console
- [ ] Slice 11 — Privacy, security, observability, and store surfaces
- [ ] Slice 12 — Integrated E2E, performance, and polish loop
- [ ] Slice 13 — TestFlight and App Store release

## Decision log

- 2026-09-21: Camera is in the product. Translate absorbs Conversation (one screen for typing, speaking, and pass-the-phone). Tabs are Translate, Camera, and Learn. Camera OCR is on-device only; captures are temporary and deleted after retake, exit, or successful processing. Photo-library permission stays off. ML Kit script-model size is unmeasured until an EAS IPA exists.

## Progress

**Current: production readiness, slice 2 — Done on tip `f41d9b7`**

Slice 1 closed on tip `5317e19` / docs `bb887ae`. Slice 2 adds typed device ports, Translate/Camera phase machines, redacted diagnostics, and `waitForIdle`. Independent review PASS after repair.

- `mobile/src/runtime/ports.ts` — translation, speech recognition/synthesis, camera, OCR, clock, ids, connectivity.
- Production + test adapters; `RuntimeProvider` (memoized) beside existing `AppServices`.
- `useTranslationSession` translates through the runtime port; integration proves a recorded adapter.
- Phase machines cover idle/permission/listening/translating/error and camera capture/OCR/result paths.
- Diagnostics reject banned content keys; events carry length + content hash only.
- Proof: `npm run verify:ci` green (lint, typecheck, unit 211, integration 15 including recorded-adapter Hello→नमस्ते, verify:translate, Expo Doctor 21/21, coverage ratchet, web export). Camera UI still owns expo-camera until slice 4; speech UI still uses expo-speech-recognition events until slice 3 finishes the mic FSM wiring.
- Next: slice 3 — finish Translate interaction states.

**Previous: production readiness, slice 1 — Done on tip `5317e19`**

Reviewed baseline `b682525`. Slice 1 restores the quality signal before any further product work.

- Expo Doctor was 20/21 because `mobile/.easignore` used unanchored `ios/` and `android/`, which also ignored `modules/neptranslate-ocr`. Those patterns are now `/ios/` and `/android/`.
- `mobile/.maestro/smoke_tabs.yaml` targeted deleted `tab-conversation`. It now walks Translate, Camera, and Learn.
- The shell mode key is `translate` (`tab-translate`, `pane-translate`). Persisted preference keys and the ad-policy surface id `conversation` are unchanged so stored data and policy tests keep their meaning.
- Node `DEP0190`: coverage and translate verify scripts pass one command string to the shell instead of a shell plus a separate argument list.
- `npm run verify:ci` is the single CI entry: lexicon, lint, typecheck, unit, integration, translation verify, Expo Doctor, coverage ratchet, and web export.
- Integration isolation: each test clears the camera fixture, secure-store memory, and AsyncStorage. Jest timeout is 20s and Testing Library’s async timeout is 8s.
- Proof: local `verify:ci` ×3; GitHub Actions [agent-gates](https://github.com/maxwellabgit/nepaliTranslation/actions/runs/35628271133) success on push, then two consecutive reruns (three CI successes on the same tip). Independent review of the pre-commit tree required those gates; they are now met. Device Maestro is still unrun. Do not start TestFlight.
- Next: production readiness slice 2 — typed runtime ports and Translate/Camera state machines.

**Previous: Translate / Camera / Learn information architecture**

- Policy updated: on-device camera OCR is in scope. Images stay in temporary cache and are deleted after retake, exit, or successful processing. Photo-library permission stays off.
- Translate absorbs pass-the-phone. Conversation tab is gone. Tabs are Translate, Camera, Learn.
- Proof so far: `tsc`, `eslint --max-warnings 0`, `test:unit` (195), `test:integration` (14), `verify:translate`.
- Not proven: CocoaPods resolution of `GoogleMLKit/TextRecognition` and `TextRecognitionDevanagari` at `~> 8.0` beside Google Mobile Ads (Windows has no `pod install`), physical-device Maestro flows in `mobile/.maestro/`, and release IPA size (about 38 MB per script, unmeasured).

**Previous: H0–H6 foundation complete on tip `065f02a`** (PR branch `cursor/beta-08-admob`)

- Agent/CI merge-gate substance: **met** (verify:beta, coverage floors, backend-gate incl. SSV, Meaning Review off production routes, server consent, multi-user consensus rewards, AdMob+SSV source with ads flags off).
- Merge-gate honesty: PR #2 + this ExecPlan updated to match tip (previous FAIL was stale PR body claiming H1–H6 unproven).
- **Do not start Slice 09 / TestFlight** until founder merges foundation and opens Slice 09 intentionally.
- Named human/device gates still open (allowed under §12 while remote flags stay off):
  - Physical iPhone Apple sign-in / revoke / cancel / delete-account
  - Physical AdMob EAS matrix (keep network/rewarded ads flags off)
  - Legal consent copy beyond `2026-09-19.draft` (keep contributions/rewards off until approved)
  - Bilingual alphabet romanization / dental–retroflex sign-off
  - Device Maestro beyond tab smoke (Slice 12)

**Previous: H6 — Real AdMob + cryptographically verified SSV** (on `main`)

- Scope: `react-native-google-mobile-ads` + Expo config plugin; env-specific app/unit IDs (test mandatory outside production; production rejects test IDs); production `AdService` (UMP first, ads only when `canRequestAds`; no ATT/IDFA); expanded `decideAdPresentation` priorities + allowed placements; house copy; rewarded CTA + server session token in SSV custom_data; provisional 10-min local grant (one unresolved; 15-min expiry); `admob-ssv` ECDSA verify + `create-rewarded-session`; Settings privacy-options + inappropriate-ad help; H6 coverage floors 80%/70%.
- Proof (post-review-repair, tip `4e345e1`): agent-gates SUCCESS; backend-gate `35552584664` SUCCESS (pgTAP incl. 11_h6_rewarded_ssv + Deno SSV). Coverage floors: auth 85.82/76.76, contribution 85.78/79.3, entitlements 90.57/78.95, ads 84.42/82.79, contributionSync 90.32/74.6.
- Repair vs independent review FAIL: BufferSource typecheck; AdSlot persists 12m/24m cooldowns; HomeScreen `speaking` suppress; SSV ledger replay + authenticated-revoke pgTAP; `extensions.gen_random_bytes` under empty search_path.
- Independent review **PASS** ([review](8d8c4127-d38c-46a7-8414-9f9cc9a01dc6)) on tip `4e345e1` (+ docs `42cad58`).
- Human gate (**blocked, not passed**): EAS development build on physical iPhone — consent, banner load/failure, reward callback, SSV arrival, dismissal, backgrounding, offline house ad, entitlement suppression. Remote ads flags stay off until that gate.
- Next: do **not** merge PR #2 / do **not** start Slice 09 until remaining human/merge gates for foundation are accepted. Pushed to `cursor/beta-08-admob`.

**Previous: H5 — Learn/reward UX and UI consistency** (on `main`)

- Scope: first tab label `Translate` (mode key stays `auto`); Learn landing with Nepali alphabet + Help improve translations cards; alphabet detail (sections, large glyph, IAST dental/retroflex, normal/slow speak, quiz uniqueness, progress, completion, Back + speech hard-stop); `RewardSummaryCard` (lifetime credits, pending, Ad-free until); Contributions screen uses AppHeader/AppButton + ContributionCard + reward summary; CorrectionSheet keyboard avoidance; AppPrimitives for Learn primary actions.
- Proof: `npm run verify:beta` + `test:coverage:beta` (ratchet OK).
- Commit: `feat: finish Learn and reward-facing beta UX`
- Independent review **PASS** ([review](f75e6b8e-2757-4b4d-bc41-c3e6a9efdbd0)).
- Human gate (blocked, not passed): bilingual reviewer sign-off of exact alphabet romanizations / section titles / dental–retroflex cues.
- Next: do **not** start H6 until this session ends. Pushed to `cursor/beta-08-admob`.

**Previous: H4 — Apple identity/deletion + remove founder-only UI** (on `main`)

- Scope: official `AppleAuthenticationButton` when available; `expo-secure-store` for stable Apple user id only (never auth codes in AsyncStorage); `expo-crypto` nonces (hashed→Apple, raw→Supabase); deletion via `refreshAsync`/interactive reauth → fresh code → `delete-account` before purge; revoke listener → guest without wiping history; clear secure identity + contribution/reward caches after success; Meaning Review removed from production App/AppShell/Settings; account-summary load after sign-in + Settings mount; removed dishonest `NSPhotoLibraryUsageDescription`.
- Proof: `npm run verify:beta` + `test:coverage:beta` (auth 58.09/48.55/60 — ratchet OK).
- Commits: `70cd0b3` `fix: complete Apple identity and deletion lifecycle`; follow-up reauth session-switch fix.
- Independent review **PASS** (after reauth fix: no `signInWithIdToken` on deletion reauth).
- Human gate (blocked, not passed): physical iPhone Apple sign-in, revoke, cancel, and delete-account with configured Apple/Supabase credentials.
- Next: do **not** start H5 until this session ends; H5 is the next milestone. Pushed to `cursor/beta-08-admob`.

**Previous: H3 — Atomic server-side consent, consensus, receipts, multi-user rewards** (on `main`)

- Scope: forward migration `20260920200000_h3_atomic_consensus.sql` — `app_config.contribution_consent_version`; report idempotency `(reporter_id, idempotency_key)`; reward idempotency `(user_id, source_type, source_id)`; receipts linked to submission/ledger; DB rate-limit buckets; private SQL normalize/similarity with oversized→null; `service_submit_contribution_atomic` (service-role transactional); consent gates on report/outbox/lease/submit; Edge wrappers map `consent_required` / `consent_outdated` / `age_required`; ContributionCard complete; FeatureConfigService loads `app_config` with safe defaults.
- Proof: `npm run verify:beta` + `test:coverage:beta` (contribution 51.82/47.11/53.55). Docker unavailable locally — backend proof: backend-gate `35548244403` green (pgTAP 08–10 + Deno + concurrent reward); agent-gates `35548244418` green.
- Commit: `86245ad` `fix: make contribution validation and rewards atomic` (+ `e40d92a` pgTAP lease/seed follow-up).
- Next: independent review; do **not** start H4 in this session. Pushed to `cursor/beta-08-admob`.

**Previous: H2 — Correction metadata and reliable offline outbox** (on `main`)

- Scope: HistoryItem direction/formality/script/translationMethod/modelVersion (legacy never invents formal+deva); UUID idempotency + local fingerprint; serialized outbox mutations; states draft|queued|syncing|retry|synced|rejected; exponential retry ≤15m + jitter; mutex flush via LifecycleCoordinator; Contributions & rewards screen; CorrectionSheet Save/Submit/Cancel + label pickers.
- Proof: `npm run verify:beta` + `test:coverage:beta` (contribution + contributionSync coverage up vs H0 baseline).
- Commit: `fix: make correction outbox durable and accurately labeled`
- Independent review **PASS**.

**Previous: H1 — Production-composition integration harness** (on `main`)

- Scope: `AppServices` contracts, `NepTranslateApp`, injectable `AppProviders`, `LifecycleCoordinator`, `FeatureConfigProvider`, `AuthStatusBanner`, `App.integration-test.tsx` (8 flows on real screens).
- Proof: `npm run verify:beta` + `test:coverage:beta` (auth coverage up vs H0 baseline).
- Commit: `test: exercise the real app composition`
- Next: H2 after independent review.

**Previous: H0 — Truthful, reproducible gates** — **PASS**

- Scope: clean-checkout `verify:beta` (lexicon first), rename fake E2E → AppShell integration, delete synthetic AppState probe, CI = same `verify:beta` + coverage ratchet, console fail-on, SafeArea from `react-native-safe-area-context`, `--max-warnings 0`, MeaningReview hook deps.
- Commits: `5685a80` (H0), `b168f1b` (lock sync), `0227970` / `d26933d` (ExecPlan). Independent review **PASS**.

Unchecked P0/P1 findings from the hardening plan (Section 3) remain open until their owning milestone:

### P0 (must before foundation merge)
- [x] Clean-checkout `verify:beta` (H0)
- [x] Rename fake E2E; keep as AppShell integration until H1 real composition (H0)
- [x] Real app composition integration tests (H1)
- [ ] Maestro beyond tab smoke (H6/Slice 12)
- [x] Production AdMob + SSV crypto (H6 — source + crypto tests; device proof human-gated)
- [x] ContributionCard submit (H3)
- [x] Outbox retry after network failure (H2)
- [x] Server-side consent gate (H3)
- [x] Per-user idempotency + multi-user rewards (H3)
- [x] Consensus rewards all eligible (H3)
- [x] Atomic submit path (H3)
- [x] Model similarity in consensus (H3)
- [x] History formality/script metadata (H2)
- [x] Fresh Apple credential on deletion (H4)
- [x] Remove Meaning Review from production Settings (H4)

### P1 (before external TestFlight)
- [x] Load server feature flags (H3 FeatureConfigService loads `app_config`; fail soft to defaults; Learn stays on)
- [x] Entitlement UI (H5)
- [x] Auth error + consent UI (H4/H5) — H4: AuthStatusBanner + deletion retry/pause alerts; H5 may still polish consent UX
- [x] Learn landing + reward summary (H5)
- [ ] Alphabet roman disambiguation + bilingual sign-off (H5 code done; bilingual human gate blocked)
- [x] Console/act noise free (H0)
- [x] Coverage thresholds on changed files (H0 ratchet baseline recorded; 80/70 by H6 — **met**)
- [x] NSPhotoLibraryUsageDescription honesty (H4) — removed (no photo feature)
- [x] Tab label Translate (H5)

**Previous: Slice 08** foundation on `cursor/beta-08-admob` / now integrated on `main` tip.

- Branch: `cursor/beta-07-learn-alphabet`
- Scope: third Learn tab, alphabet + quiz, lesson position, no-voice honesty.
- Review: FAIL → **PASS**. CI: agent-gates `35484367709`, backend-gate `35484367702`. Commit: `585358e`.
- Human gate: bilingual alphabet sign-off.

- Branch: `cursor/beta-06-reward-ledger`
- Scope: UTC daily caps (60 contribution / 12 video), schedule RPC, trusted-time, decideAdPresentation, EntitlementProvider.
- Review: FAIL → FAIL → **PASS** (idempotent cap order; in-process trusted clock; null trusted time cannot mint).
- CI: agent-gates `35483996952` green; backend-gate `35483996973` green (pgTAP + concurrent reward).
- Commit: `a1965bb`. Ads remain mocked/off (Slice 08).

**Previous: Slice 05** complete (review PASS after opacity + band lease; CI green).

- Branch: `cursor/beta-05-contribution-queue` (stacked on Slice 04)
- Scope: consensus module + submit-contribution + assignment ratio test + ContributionCard (flag off by default).
- Review: acceptance FAIL (lease ratios unwired; submit envelope leaked known vs unknown) → fixed in follow-up commit; band lease shares + opaque submit response.
- Human gates: legal consent still draft; contributionsEnabled remains false.

**Previous: Slice 04** complete (review PASS; CI green).

- Branch: `cursor/beta-04-correction-outbox`
- Review: product wiring PASS; Done blocked until CI → agent-gates `35481941650` and backend-gate `35481941665` green → **PASS**.
- Commit: `e67a2a4`.

- Branch: `cursor/beta-03-apple-auth`
- Scope: optional Apple identity, versioned draft consent, resumable delete-account. No login wall on translate/history/settings/learn. No live Apple/Supabase project secrets in the bundle.
- Human gates (not claimed): Apple capability + Supabase Apple provider; legal review of consent copy; physical device sign-in/deletion.
- Review: round 1 FAIL (deletion not resumable, Apple revoke skipped token exchange, service-role JWT not rejected) → fixed; round 2 **PASS**.
- CI: agent-gates `35465801990` green; backend-gate `35465801979` green (start, reset, lint, pgTAP, deno, concurrent reward).
- Commit: `7af191a`. Human gates remain open.

**Previous: Slice 02** complete (backend-gate CI green, review PASS).

- Branch: `cursor/beta-02-supabase-skeleton`
- Backend gate CI run `35460874866` succeeded: supabase start, db reset, db lint, pgTAP, deno test, concurrent reward.
- Local Docker was unavailable; proof is that GitHub Actions run, not a local `supabase start`.
- Seed is synthetic (`SYNQC01`), not from `benchmarks/gold/`.


- Branch: `cursor/beta-01-test-harness` (stacked on Slice 00)
- Added: jest-expo + RTL + eslint, `AppShell` / `hardStopAudio` / primitives, unit tests (tab persistence, hard-stop, History clear, Mark incorrect, passLogic, storage parse, app-state), CI mobile gate + secret scan
- SDK stayed on Expo 57; aligned `expo@^57.0.9`, `react-native@0.86.3`, expo module patches, added `expo-font`, removed local `eas-cli` so `expo-doctor` passes
- Known deferral: `app.json` still has temporary `reviewSync*` values — removed in Slice 04; secret scan does not treat them as new production keys
- Review: round 1 FAIL (expo-doctor patch drift) → fixed; round 2 **PASS**


## Surprises & discoveries

- Local worktree was behind `origin/main` (`cc255d2` vs baseline `43f14b0`). Branched from `origin/main` at the plan baseline.
- Tracked WIP unrelated to beta was stashed as `wip-before-beta-00-tracked` before branching.
- Untracked `training/artifacts/` and similar local files remain on disk; they are not part of this slice and must not be committed.

## Decision log

- 2026-09-19: One living ExecPlan (`beta-release`) tracks all beta slices; only one slice is in progress at a time. Existing lanes 1–5 remain valid for MT/eval/UI work and must not mix into a beta PR.
- 2026-09-19: Contributor known checks are explicitly forbidden from `benchmarks/gold/` in AGENTS, INTENT, DONE, and this plan.
- 2026-09-19: Public App Store metadata must not say “beta” / “test”; Apple “beta” distribution is TestFlight only.
- 2026-09-19: Login required only for contributions and rewards — never for translation, history, settings, or Learn alphabet.
- 2026-09-19: Slice 02 backend gate runs in GitHub Actions when Docker is unavailable locally. Do not claim `supabase start` proof from this machine.
- 2026-09-20: PR #2 foundation hardening (H0–H6) works on **`main`**. Do not merge PR #2 / start Slice 09 until H0–H6 pass. H0 records coverage baseline without manufacturing shallow tests.

## Commands that actually ran (paste)

### Slice 00
```text
# HEAD baseline 43f14b0; docs commit 6be3fb1
cd mobile && npm ci && npx --no-install tsc --noEmit && npm run verify:translate
# TSC_EXIT=0 VERIFY_EXIT=0
```

### Slice 01
```text
cd mobile
npm install --save-dev jest-expo jest@~29.7.0 @types/jest@29.5.14 @testing-library/react-native @react-native/jest-preset test-renderer eslint@^9 eslint-config-expo --legacy-peer-deps
npx expo install expo-font expo@^57.0.9 react-native@0.86.3
npm uninstall eas-cli --legacy-peer-deps

npm run lint          # exit 0 (2 pre-existing warnings allowed)
npm run typecheck     # exit 0
npm run test:unit -- --runInBand   # 7 suites / 20 tests passed
npm run verify:translate           # OK
npx expo-doctor                    # 21/21 passed
```

### Slice 02
```text
docker version   # engine not running (pipe dockerDesktopLinuxEngine missing)
supabase --version  # CLI not installed
deno --version      # not installed

node --experimental-strip-types  # local check of scoring fixtures
# formal/informal "तपाईं जानुहोस्" vs "तिमी जाऊ" similarity 0.1875, knownCheckPasses false
# negation "म आज जान्छु" vs "म आज जाँदिन" similarity ~0.64, below 0.72
# NFC का vs decomposed similarity 1

# Database gate is .github/workflows/backend-gate.yml
# (supabase start, db reset, db lint, test db, deno test, concurrent_reward.sh)
# backend-gate run 35460874866 green; agent-gates run 35461426076 green
```

### Slice 03 (local, 2026-09-19)
```text
cd mobile
npm run lint          # exit 0 (2 pre-existing warnings)
npm run typecheck     # exit 0
npm run test:unit -- --runInBand   # 9 suites / 28 tests passed
npm run verify:translate           # OK
npx expo-doctor                    # 21/21 passed
# docker / supabase CLI / deno: not available on this machine
# backend-gate CI is the proof for migration 20260919200000 + deletion_test.ts
# agent-gates 35465801990 green; backend-gate 35465801979 green
```

### Slice 04 (local, 2026-09-19)
```text
cd mobile
npm run lint          # exit 0 (2 pre-existing warnings)
npm run typecheck     # exit 0
npm run test:unit -- --runInBand   # 10 suites / 31 tests passed
npm run verify:translate           # OK
npx expo-doctor                    # 21/21 passed
# agent-gates 35481941650 green; backend-gate 35481941665 green
```

### Slice 05 (local + CI, 2026-09-19)
```text
cd mobile
npm run lint / typecheck / test:unit / verify:translate  # green (32 tests)
# agent-gates 35482604781; backend-gate 35482604776 (pre-fix)
# follow-up: lease returns assignment_id + ownership pgTAP
# acceptance fix CI: agent-gates 35483222552 / backend-gate 35483222563
```

### Slice 06 (local + CI, 2026-09-19)
```text
cd mobile
npm run lint / typecheck / test:unit (39) / verify:translate / expo-doctor  # green
# backend-gate FAIL 35483905079 (reward_schedule RETURNS TABLE mismatch)
# fix commit a1965bb → agent-gates 35483996952 + backend-gate 35483996973 green
# independent-reviewer PASS
```

### Slice 07 (local + CI, 2026-09-19)
```text
cd mobile
npm run lint / typecheck / test:unit (45) / verify:translate / expo-doctor  # green
# agent-gates 35484367709 green; backend-gate 35484367702 green
# independent-reviewer PASS; bilingual sign-off human-gated
```

### H0 (local, 2026-09-20, on `main`)
```text
cd mobile
# Delete generated lexicon to simulate clean checkout:
Remove-Item src\mt\generated\meaningLexicon.json
npm run verify:beta
# exit 0 — export:lexicon first, lint max-warnings 0, typecheck,
# test:unit 15 suites / 49 tests, test:integration 1 suite / 3 tests,
# verify:translate OK, expo-doctor 21/21
npm run test:coverage:beta
# Wrote mobile/coverage/beta-critical-baseline.json
# auth 16.56/23.2/18.25, contribution 21.84/9.09/22.5,
# entitlements 18.52/30.14/20.62, ads 50.94/40/54,
# contributionSync 3.33/0/3.57 (statements/branches/lines)
# Follow-up: expo install synced react-native-safe-area-context@~5.7.0
#   so `npm ci` matches package.json (CI fix after 35544430973)
```

### H3 (local, 2026-09-20, on `main`)
```text
cd mobile
npm run verify:beta
# lint max-warnings 0, typecheck, test:unit 23 suites / 74 tests,
# test:integration 2 suites / 11 tests, verify:translate OK, expo-doctor 21/21
npm run test:coverage:beta
# contribution 51.82/47.11/53.55 — ratchet OK
# docker / supabase start: engine not running
# backend-gate 35548244403 green; agent-gates 35548244418 green
#   (pgTAP 08–10; first push failed 03/06 lease assertions → e40d92a fix)
```

### H6 (tip `4e345e1`, on `main` / `cursor/beta-08-admob`)
```text
agent-gates: SUCCESS (verify:beta + coverage floors)
backend-gate 35552584664: SUCCESS
  pgTAP (incl. 11_h6_rewarded_ssv) + Deno admob_ssv_test + concurrent reward
# Human gate blocked: physical iPhone AdMob test ads / SSV / house / entitlement
```

### H5 (local, 2026-09-20, on `main`)
```text
cd mobile
npm run verify:beta
# lint max-warnings 0, typecheck, test:unit 26 suites / 105 tests,
# test:integration 2 suites / 12 tests, verify:translate OK, expo-doctor 21/21
npm run test:coverage:beta
# Coverage ratchet OK (no decrease vs H0 baseline)
# Human gate blocked: bilingual alphabet roman/section/place sign-off
```

### H4 (local, 2026-09-20, on `main`)
```text
cd mobile
npm run verify:beta
# lint max-warnings 0, typecheck, test:unit 25 suites / 96 tests,
# test:integration 2 suites / 12 tests, verify:translate OK, expo-doctor 21/21
npm run test:coverage:beta
# auth 58.09/48.55/60 — ratchet OK (up vs H0 baseline)
# Independent review PASS after reauth session-switch fix
# Human gate blocked: physical iPhone Apple sign-in / revoke / cancel / delete-account
```

### H2 (local, 2026-09-20, on `main`)
```text
cd mobile
npm run verify:beta
# lint max-warnings 0, typecheck, test:unit 21 suites / 66+ tests,
# test:integration 2 suites / 11 tests, verify:translate OK, expo-doctor 21/21
npm run test:coverage:beta
# contribution 45.76/43.12/47.75, contributionSync 82.35/71.43/88.71
# Coverage ratchet OK (no decrease vs H0 baseline)
# Independent review: FAIL (production NetworkService stub) → fixed expo-network
#   + LifecycleCoordinator offline→online test → PASS
```

### Slice 08 (local + cleanup/E2E, 2026-09-19)
```text
cd mobile
npm run verify:beta
# lint (2 pre-existing warnings), typecheck, test:unit 17 suites / 53 tests,
# test:e2e 3 passed (appE2E-test), verify:translate OK, expo-doctor 21/21
# Maestro CLI not installed on this machine — smoke_tabs.yaml is source-ready;
#   device Maestro run is a Slice 12 / human gate
# gitignore: training/artifacts, review_sync credentials, tools/*.exe
```

## Remaining work

- **H6** complete for agent/CI scope (independent review PASS; agent-gates + backend-gate `35552584664` green). Physical AdMob device proof remains a **human-gated blocker** (flags stay off).
- Do **not** merge PR #2 / do **not** start Slice 09 until H0–H6 merge gates (including remaining human gates as required by §12) are accepted.
- Human gates remain: Apple, Supabase Apple, legal consent, physical device (H4 Apple identity/deletion blocked), AdMob (H6 blocked), RevenueCat, bilingual Learn sign-off (H5 blocked), Maestro device run, TestFlight.

## Blockers (concrete; cannot be solved from this repo)

- Docker Desktop engine is not running, so `supabase start` / pgTAP cannot run on this machine. Backend proof is `.github/workflows/backend-gate.yml`.
- Slice 03 human gates (not claimed): Apple Sign in capability on the App ID, Supabase Apple provider, legal review of consent version `2026-09-19.draft`, physical-device sign-in and account deletion. Missing `APPLE_CLIENT_ID` / `APPLE_CLIENT_SECRET` blocks deletion before any purge. Deleting the app account does not cancel an Apple subscription.
- **H4 human gate (blocked, not passed):** real iPhone Apple sign-in, credential revoke, cancel refresh, and delete-account with configured Apple/Supabase credentials. Do not claim device proof from Jest fakes.
- Slice 07 human gate (not claimed): bilingual Nepali sign-off of bundled alphabet romanizations and section titles. **H5 refreshed the IAST dental/retroflex cues; sign-off remains blocked, not passed.**
- Slice 08 human gates (not claimed): AdMob app registration, banner/rewarded unit IDs, `react-native-google-mobile-ads` in a native/dev client, physical-device ad load proof.
- **H6 human gate (blocked, not passed):** EAS development build on a physical iPhone using AdMob **test** ads — prove consent, banner load/failure, reward callback, SSV arrival, dismissal, backgrounding, offline house ad, and entitlement suppression. Do not claim device proof from Jest. Keep `network_ads_enabled` / `rewarded_ads_enabled` off until that gate.
- Device Maestro (`mobile/.maestro/smoke_tabs.yaml`): Maestro CLI + running iOS app not available on this Windows agent — human / Slice 12 gate.
