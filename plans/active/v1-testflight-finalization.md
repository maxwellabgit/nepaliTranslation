# v1-testflight-finalization: Gate G0–G7 ship readiness

## Goal
Make NepTranslate honestly ready for external TestFlight and then V1 — fixing audit blockers in review-pool contract, consent/deletion, monetization SDK/identity, model/device certification, and production ops — without breaking offline guest Translate, Camera, History, Settings, or Learn.

## Context (paths, commands, constraints)

- **Audit tip:** `43f9bc6` (2026-09-22). F0–F10 source merged; **not** external RC.
- **Contract freeze:** `.governance/V1_G0_DECISIONS.md`, `.governance/DATA_CLASSIFICATION.md`, `.governance/INTENT.md`.
- **Branch policy:** exactly one gate per branch/PR: `cursor/v1-gN-short-name-5907` (or current agent suffix).
- **Operating protocol:** `AGENTS.md`, `.agent/LOOP.md`, `.agent/DONE.md`, this ExecPlan.
- **Protected:** `mobile/src/mt/`, `mobile/src/stt/`, translation verify scripts, Expo SDK 57, `benchmarks/gold/` references.
- **Prohibited:** invent device/TestFlight/revenue results; expose frozen gold for public review; claw back credits; guest purchase/restore; claim speech-media upload in V1 disclosures.
- **Prior program:** `plans/active/beta-release.md` (F0–F10) is **foundation / closed as ship program**. Do not reopen F-slices.

## Done when (copy the lane checklist from DONE.md)

V1-wide + current-gate checklist in `.agent/DONE.md`. G0 specifically: durable docs only; no runtime code; a fresh session can state review cardinality, corpus rules, sign-in-before-purchase, speech deferred, interstitial impression timer, and that `43f9bc6` is not external RC.

## Milestones

- [ ] **G0** — Freeze corrected product contract (docs only) — pending independent review PASS + merge
- [ ] **G1** — Public-review pool schema, importer, exclusive allocation, admin adjudication, 5 PM grants + late alerts
- [ ] **G2** — Bilingual consent, withdrawal, truthful privacy copy, complete 30-day purge
- [ ] **G3** — Ads load/show via real SDK events; impression-based interstitial timer; RevenueCat↔Supabase UUID; sandbox matrix recorded or blocked
- [ ] **G4** — Exact ONNX hash + four-class eval; DEVICE_PROOF physical evidence
- [ ] **G5** — Hosted scheduler proof, secrets, legal URLs, alerts, backups, kill switches
- [ ] **G6** — Internal TestFlight candidate; staged remote flag enablement; zero open P0/P1 for enabled surfaces
- [ ] **G7** — External cohort ≥ seven stable NY days; signed go/no-go

## Progress

**Current: G0 — contract freeze (docs only)**

| Area | Change |
|------|--------|
| Decisions | `.governance/V1_G0_DECISIONS.md` — D1–D7 |
| Data classes | `.governance/DATA_CLASSIFICATION.md` |
| INTENT / AGENTS / DONE | Aligned to G0–G7; speech deferred; sign-in before purchase; up to 10/reviewer/day; impression timer |
| ExecPlans | This file active; beta-release marked foundation-only |
| CERTIFICATION / RELEASE_RUNBOOK | Honesty: not external RC; product freeze text updated |

## Surprises & discoveries

- Audit: `react-native-google-mobile-ads` v17 `load()` returns `void`; app `.catch` is a real breakage masked by mocks (fix in G3).
- Soft ship-cert CI can be green with missing ONNX weights — must not be treated as G4 Done.
- Preliminary public-review runway ~649 items ≈ tens of reviewer-days — UI must say “up to 10.”
- Independent review (first pass): FAIL — `docs/DEVICE_PROOF.md` still required post-consent speech upload; fixed to photo-only + speech deferred.

## Decision log

- 2026-09-22: **G0 freeze** per audit — up to 10 per reviewer per NY day; corpus eligibility + benchmark retirement; sign-in before purchase/restore/contribution; raw speech-media **deferred** from V1 disclosures; interstitial = 15 min since last successful impression; F0–F10 not ship-ready; program = G0–G7.

## Commands that actually ran (paste)

```text
git fetch origin && git pull origin main   # already at 43f9bc6
# Docs-only gate: no mobile/admin/supabase runtime changes
# Independent review FAIL on DEVICE_PROOF speech line → fixed
```

## Remaining work

1. Independent review **PASS** (`79203fd`). Merge G0 when PR can be opened.
2. **Blocker:** `ManagePullRequest` create failed with GitHub validation `must be a collaborator` — branch is pushed; human/collaborator must open PR from `cursor/v1-g0-contract-freeze-5907` → `main`, or grant collaborator access.
3. G1: review pool + importer (do not start until G0 merged).
4. Human blockers unchanged: device matrix, AdMob/RevenueCat consoles, legal hosting, ONNX weights on eval host, production cron.

## Blockers (concrete; cannot be solved from this repo)

- Exact ONNX weights under `mobile/assets/models/` for four-class eval
- Physical iPhone/iPad proof
- Production Supabase cron / scheduler provisioning and monitoring
- Live Privacy/Terms/support/deletion/`app-ads.txt` hosting
- App Store Connect + RevenueCat + AdMob production configuration
- Legal review of bilingual consent before live collection
- ManagePullRequest create failed once with collaborator validation — retry after fix commit
