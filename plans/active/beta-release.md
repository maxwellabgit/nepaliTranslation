# beta-release: App Store / TestFlight release candidate program

## Goal
Ship an iOS external TestFlight beta, then a public App Store release candidate, without breaking offline EN↔NE translation. Core translate, Conversation, History, Settings, and Learn stay usable without login; Supabase / ads / subscription are optional services that must fail soft.

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

- [ ] H0 — Truthful, reproducible gates (gates green locally; independent review pending)
- [ ] H1 — Production-composition integration harness
- [ ] H2 — Correction metadata and reliable offline outbox
- [ ] H3 — Atomic server-side consent, consensus, receipts, multi-user rewards
- [ ] H4 — Apple identity/deletion + remove founder-only UI
- [ ] H5 — Learn, reward visibility, accessibility, UI consistency
- [ ] H6 — Real AdMob + cryptographically verified SSV
- [ ] Merge foundation only after every H0–H6 merge gate passes

### Later slices (separate PRs after foundation)

- [ ] Slice 09 — StoreKit subscription through RevenueCat
- [ ] Slice 10 — Protected admin console
- [ ] Slice 11 — Privacy, security, observability, and store surfaces
- [ ] Slice 12 — Integrated E2E, performance, and polish loop
- [ ] Slice 13 — TestFlight and App Store release

## Progress

**Current: H0 — Truthful, reproducible gates** (on `main`)

- Scope: clean-checkout `verify:beta` (lexicon first), rename fake E2E → AppShell integration, delete synthetic AppState probe, CI = same `verify:beta` + coverage ratchet, console fail-on, SafeArea from `react-native-safe-area-context`, `--max-warnings 0`, MeaningReview hook deps.
- Proof (2026-09-20): deleted `meaningLexicon.json`, then `npm run verify:beta` exit 0 (15 unit / 49 tests + 1 integration / 3 tests; translate OK; expo-doctor 21/21). `npm run test:coverage:beta` wrote `mobile/coverage/beta-critical-baseline.json`.
- Commit: `5685a80` (`test: make beta proof clean-checkout reproducible`).
- PR #2 title/body updated (no fake-pane “E2E” claim). Branch `cursor/beta-08-admob` fast-forwarded to `5685a80` for CI; local `main` holds the same tip (origin/main push blocked pending review).
- **Stop before H1** until independent review PASS.

Unchecked P0/P1 findings from the hardening plan (Section 3) remain open until their owning milestone:

### P0 (must before foundation merge)
- [x] Clean-checkout `verify:beta` (H0)
- [x] Rename fake E2E; keep as AppShell integration until H1 real composition (H0)
- [ ] Maestro beyond tab smoke (H6/Slice 12)
- [ ] Production AdMob + SSV crypto (H6)
- [ ] ContributionCard submit (H2/H3)
- [ ] Outbox retry after network failure (H2)
- [ ] Server-side consent gate (H3)
- [ ] Per-user idempotency + multi-user rewards (H3)
- [ ] Consensus rewards all eligible (H3)
- [ ] Atomic submit path (H3)
- [ ] Model similarity in consensus (H3)
- [ ] History formality/script metadata (H2)
- [ ] Fresh Apple credential on deletion (H4)
- [ ] Remove Meaning Review from production Settings (H4)

### P1 (before external TestFlight)
- [ ] Load server feature flags (H1+)
- [ ] Entitlement UI (H5)
- [ ] Auth error + consent UI (H4/H5)
- [ ] Learn landing + reward summary (H5)
- [ ] Alphabet roman disambiguation + bilingual sign-off (H5 + human)
- [x] Console/act noise free (H0)
- [x] Coverage thresholds on changed files (H0 ratchet baseline recorded; 80/70 by H6)
- [ ] NSPhotoLibraryUsageDescription honesty (H4/H11)
- [ ] Tab label Translate (H5)

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

- **H0** independent review → then H1 production-composition harness (not started).
- Do **not** merge PR #2 / do **not** start Slice 09 until H0–H6 merge gates pass.
- Human gates remain: Apple, Supabase Apple, legal consent, physical device, AdMob, RevenueCat, bilingual Learn sign-off, Maestro device run, TestFlight.

## Blockers (concrete; cannot be solved from this repo)

- Docker Desktop engine is not running, so `supabase start` / pgTAP cannot run on this machine. Backend proof is `.github/workflows/backend-gate.yml`.
- Slice 03 human gates (not claimed): Apple Sign in capability on the App ID, Supabase Apple provider, legal review of consent version `2026-09-19.draft`, physical-device sign-in and account deletion. Missing `APPLE_CLIENT_ID` / `APPLE_CLIENT_SECRET` blocks deletion before any purge. Deleting the app account does not cancel an Apple subscription.
- Slice 07 human gate (not claimed): bilingual Nepali sign-off of bundled alphabet romanizations and section titles.
- Slice 08 human gates (not claimed): AdMob app registration, banner/rewarded unit IDs, `react-native-google-mobile-ads` in a native/dev client, physical-device ad load proof.
- Device Maestro (`mobile/.maestro/smoke_tabs.yaml`): Maestro CLI + running iOS app not available on this Windows agent — human / Slice 12 gate.
