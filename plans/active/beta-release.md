# beta-release: App Store / TestFlight release candidate program

## Goal
Ship an iOS external TestFlight beta, then a public App Store release candidate, without breaking offline EN↔NE translation. Core translate, Conversation, History, Settings, and Learn stay usable without login; Supabase / ads / subscription are optional services that must fail soft.

## Context (paths, commands, constraints)

- **Baseline:** `main` at `43f14b0adc2dd596f9eb64bc79aea2bece5d9406` (2026-09-19).
- **Branch naming:** `cursor/beta-XX-short-name` (one slice per branch / PR).
- **Product contract:** `.governance/INTENT.md` (offline core + optional online services).
- **Operating protocol:** `AGENTS.md`, `.agent/LOOP.md`, `.agent/DONE.md`, this ExecPlan.
- **Source plan:** founder App Store beta implementation plan (slices 00–13). Do not combine adjacent slices.
- **Protected:** `mobile/src/mt/`, `mobile/src/stt/`, translation verify scripts, Expo SDK 57. No model-family change; no cloud translation.
- **Prohibited files / data:** never edit or copy contributor known-check answers from `benchmarks/gold/` (or any private holdout / training eval answers). Known checks are a separate curated seed under backend/admin data only.
- **Release blockers already identified:** embedded review-sync URL/secret; hard-coded Meaning Review password `1234`.

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

- [x] Slice 00 — Product contract and release lane (this file + INTENT / AGENTS / DONE updates)
- [x] Slice 01 — Test harness and UI primitives (independent review PASS)
- [x] Slice 02 — Supabase schema, RLS, and API skeleton (independent review PASS; backend-gate CI green)
- [x] Slice 03 — Sign in with Apple, consent, and deletion (independent review PASS; agent-gates `35465801990` and backend-gate `35465801979` green)
- [ ] Slice 04 — Unified correction sheet and offline outbox
- [ ] Slice 05 — Contribution queue, hidden checks, and consensus
- [ ] Slice 06 — Reward ledger and entitlement service
- [ ] Slice 07 — Learn alphabet
- [ ] Slice 08 — AdMob adapter and ad middleware
- [ ] Slice 09 — StoreKit subscription through RevenueCat
- [ ] Slice 10 — Protected admin console
- [ ] Slice 11 — Privacy, security, observability, and store surfaces
- [ ] Slice 12 — Integrated E2E, performance, and polish loop
- [ ] Slice 13 — TestFlight and App Store release

## Progress

**Current slice: 03 — Sign in with Apple, consent, and deletion**

- Branch: `cursor/beta-03-apple-auth` (stacked on Slice 02)
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
- 2026-09-19: Contributor known-check seed is synthetic (`SYNQC01…`), not copied from `benchmarks/gold/`.


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

## Remaining work

- Next slice: 04 correction sheet and offline outbox on `cursor/beta-04-correction-outbox`. Remove the temporary review-sync endpoint, secret, and Meaning Review password `1234` in that slice only.
- Slice 03 human gates stay open: Apple Sign in capability, Supabase Apple provider, legal review of consent `2026-09-19.draft`, physical-device sign-in and account deletion.

## Blockers (concrete; cannot be solved from this repo)

- Docker Desktop engine is not running, so `supabase start` / pgTAP cannot run on this machine. Backend proof is `.github/workflows/backend-gate.yml`.
- Slice 03 human gates (not claimed): Apple Sign in capability on the App ID, Supabase Apple provider, legal review of consent version `2026-09-19.draft`, physical-device sign-in and account deletion. Missing `APPLE_CLIENT_ID` / `APPLE_CLIENT_SECRET` blocks deletion before any purge. Deleting the app account does not cancel an Apple subscription.
