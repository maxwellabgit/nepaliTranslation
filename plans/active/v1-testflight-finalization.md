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

- [ ] **G0** — Freeze corrected product contract (docs only) — amended per owner directive; pending re-review + merge
- [ ] **G1** — Global 10/day public-review pool schema, importer of all corpora, 5 PM rotation, admin adjudication
- [ ] **G2** — Startup consent gate (T&C + Privacy + 18+), account-linked collection, raw speech + photo upload, withdrawal, 30-day purge
- [ ] **G3** — Ads load/show via real SDK events; impression-based interstitial timer; RevenueCat↔Supabase UUID; sandbox matrix recorded or blocked
- [ ] **G4** — Exact ONNX hash + four-class eval; DEVICE_PROOF physical evidence
- [ ] **G5** — Hosted scheduler proof, secrets, legal URLs, alerts, backups, kill switches
- [ ] **G6** — Internal TestFlight candidate; staged remote flag enablement; zero open P0/P1 for enabled surfaces
- [ ] **G7** — External cohort ≥ seven stable NY days; signed go/no-go

## Progress

**Current: G0 amended — contract freeze (docs only)**

| Area | Change |
|------|--------|
| Decisions | `.governance/V1_G0_DECISIONS.md` amended: D1 global 10/day + 5 PM rotation; D2 all corpora eligible + length-percentile tier; D4 startup consent gate + speech in V1; D6 1 credit = 15 min |
| Data classes | `.governance/DATA_CLASSIFICATION.md` — training + benchmark rows all eligible for review; submissions never re-enter training/eval without a separate verification |
| INTENT / AGENTS / DONE | Aligned to amended freeze |
| ExecPlans | This file active; `beta-release.md` foundation-only |
| CERTIFICATION / RELEASE_RUNBOOK | Will follow in G0 fix commit |

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

1. Independent re-review of amended G0. Merge when PR is openable (collaborator blocker unresolved).
2. **G1** on branch `cursor/v1-g1-review-pool-5907`: schema, importer, rotation function, admin adjudication, backend tests.
3. **G2** on branch `cursor/v1-g2-consent-deletion-5907`: startup consent screen, account-linked schemas, speech capture URI, retry queue, withdrawal + account-deletion 30-day purge, Privacy Policy strings.
4. **G3** on branch `cursor/v1-g3-monetization-5907`: rewrite `AdService` around real SDK events, impression-based interstitial timer, RevenueCat identity, CustomerInfo refresh.
5. **G4** on branch `cursor/v1-g4-model-device-5907`: attempt exact ONNX fetch + hash + four-class eval; on missing weights, record concrete blocker.
6. **G5** on branch `cursor/v1-g5-ops-5907`: hosted scheduler cron for 5 PM rotation + 30-day purge; secrets/kill switches/legal URLs blockers.

## Blockers (concrete; cannot be solved from this repo)

- Exact ONNX weights under `mobile/assets/models/` for four-class eval (G4)
- Physical iPhone/iPad proof (G4/G6)
- Production Supabase cron / scheduler provisioning and monitoring (G5)
- Live Privacy/Terms/support/deletion/`app-ads.txt` hosting (G5)
- App Store Connect + RevenueCat + AdMob production configuration (G3/G5)
- Legal review of bilingual startup consent + Privacy Policy before live collection (G2)
- Docker Desktop not available on this agent host → `supabase db reset` runs in CI, not locally
- `ManagePullRequest` create failed with GitHub `must be a collaborator` — branches are pushed; human must open PRs
