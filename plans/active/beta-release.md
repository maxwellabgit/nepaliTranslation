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
- [ ] Slice 01 — Test harness and UI primitives
- [ ] Slice 02 — Supabase schema, RLS, and API skeleton
- [ ] Slice 03 — Sign in with Apple, consent, and deletion
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

**Current slice: 00 — Product contract and release lane** (complete; independent review PASS)

- Branch: `cursor/beta-00-product-contract`
- Scope: governance + ExecPlan only. No `mobile/` runtime, no `supabase/`, no `admin/` code in this slice.
- Acceptance: durable target / current slice / tests / prohibited-file rules readable without chat history.
- Review: round 1 FAIL → fixed; round 2 **PASS**.


## Surprises & discoveries

- Local worktree was behind `origin/main` (`cc255d2` vs baseline `43f14b0`). Branched from `origin/main` at the plan baseline.
- Tracked WIP unrelated to beta was stashed as `wip-before-beta-00-tracked` before branching.
- Untracked `training/artifacts/` and similar local files remain on disk; they are not part of this slice and must not be committed.

## Decision log

- 2026-09-19: One living ExecPlan (`beta-release`) tracks all beta slices; only one slice is in progress at a time. Existing lanes 1–5 remain valid for MT/eval/UI work and must not mix into a beta PR.
- 2026-09-19: Contributor known checks are explicitly forbidden from `benchmarks/gold/` in AGENTS, INTENT, DONE, and this plan.
- 2026-09-19: Public App Store metadata must not say “beta” / “test”; Apple “beta” distribution is TestFlight only.
- 2026-09-19: Login required only for contributions and rewards — never for translation, history, settings, or Learn alphabet.

## Commands that actually ran (paste)

```text
git fetch origin
git stash push -m "wip-before-beta-00-tracked" -- <tracked WIP paths>
git checkout -B cursor/beta-00-product-contract origin/main
# HEAD = 43f14b0adc2dd596f9eb64bc79aea2bece5d9406

cd mobile
npm ci
node ./scripts/export_meaning_lexicon.mjs
# [lexicon] wrote src\mt\generated\meaningLexicon.json (86 KB) en=140 ne=194 romanSent=256 romanWords=302

npx --no-install tsc --noEmit
# TSC_EXIT=0

npm run verify:translate
# OK (phrase / register / mashup / romanize checks); VERIFY_EXIT=0
```

Independent review round 1 **FAIL** (staged local artifacts/credentials polluted the tree; baseline tsc not yet re-proven after `npm ci`). Fixed: `git reset HEAD` so only governance/docs remain; re-ran `tsc` green. Round 2 pending.

Slice 00 commit scope (only these paths):

- `plans/active/beta-release.md` (new)
- `plans/README.md`
- `.governance/INTENT.md`
- `.agent/DONE.md`
- `.agent/REVIEW.md`
- `AGENTS.md`

Local untracked `tools/`, `training/artifacts/**`, `training/data/*review*` must **not** be added. Stash `wip-before-beta-00-tracked` holds unrelated prior WIP.

Independent review: round 1 FAIL → fixed; round 2 **PASS** (no material findings).

## Remaining work

- Slice 00: commit docs-only change set; open PR when requested.
- Next slice: `cursor/beta-01-test-harness` after Slice 00 is on the branch (and ideally merged).

## Blockers (concrete; cannot be solved from this repo)

None for Slice 00 (docs only). Later slices will hit human gates listed in INTENT / AGENTS (Apple / Supabase / AdMob / RevenueCat / legal / bilingual review / physical device).
