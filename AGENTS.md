# NepTranslate — agent operating system

Offline-first iOS / iPadOS English ↔ Nepali translator (`mobile/`). Intent lives in [`.governance/INTENT.md`](.governance/INTENT.md). Architecture lives in [`training/ARCHITECTURE.md`](training/ARCHITECTURE.md). Gold eval lives in [`benchmarks/gold/`](benchmarks/gold/). **Ship program (active):** final contract reconciliation gates **C0–C15** in [`plans/active/v1-final-contract-reconciliation.md`](plans/active/v1-final-contract-reconciliation.md). Progress: [`.agent/V1_FINAL_CONTRACT_STATE.md`](.agent/V1_FINAL_CONTRACT_STATE.md). Contract table: [`.governance/V1_G0_DECISIONS.md`](.governance/V1_G0_DECISIONS.md). Prior F0–F10 ([`plans/active/beta-release.md`](plans/active/beta-release.md)), G0–G7 ([`plans/active/v1-testflight-finalization.md`](plans/active/v1-testflight-finalization.md)), and R0–R9 ([`plans/active/v1-testflight-runbook.md`](plans/active/v1-testflight-runbook.md)) are historical. The 2026-09-22 audit remains at [`docs/NepTranslate_V1_Finalization_and_TestFlight_Runbook_71c85df.md`](docs/NepTranslate_V1_Finalization_and_TestFlight_Runbook_71c85df.md).

A fresh agent must be able to enter this repo and know the product, the current lane, remaining work, and how to prove Done. Chat is disposable. These files are not.

## Read before you touch code

1. This file
2. `.governance/INTENT.md` and `.governance/V1_G0_DECISIONS.md`
3. `.agent/LOOP.md` and `.agent/DONE.md`
4. The **one** active plan for your line of effort under `plans/active/`

Do not mix lanes in one run or one PR.

## Lines of effort (rank order)

### Core quality lanes

Ranked by likelihood that an autonomous agent produces a real, checkable improvement in **this** repo. Each line is a separate agent, a separate ExecPlan, and a separate PR.

| Rank | Lane | Why it works here | Launch |
|------|------|-------------------|--------|
| **1** | Eval integrity | Gold is already the ship gate. Schema, leakage, register purity, and freeze checks are file-based and numeric. If gold is dirty, every accuracy claim is false. | `/eval-steward` |
| **2** | UI bug hunt | The product is Expo screens plus overlays. Most bugs are in source. `npm run verify:translate` is the cheap gate. Device-only bugs are listed, not faked. | `/ui-hunter` |
| **3** | Translation accuracy (decode path) | Phrase overlay, romanize, mashup refusal, and lexicon already have scripts. Improve JS/TS MT **without** editing gold answers. Gold scores are the gate. | `/mt-accuracy` |
| **4** | App runtime / efficiency | Warm-up, cancel, STT stop, pass-the-phone, fallbacks are in-repo. Real UX wins; slightly more judgment than 1–3. | `/app-runtime` |
| **5** | Model / on-device ship | Fine-tune, ONNX export, TestFlight weights. Industry-standard, but needs GPU/artifacts a cloud box often lacks. Honest blockers beat fake training. | `/model-ship` |

Do **not** start lane 5 until lane 1 is clean. Do **not** claim translation quality from UI-only diffs.

### Production V1 final contract (dependency order)

Full-business V1 readiness uses **one** living ExecPlan: `plans/active/v1-final-contract-reconciliation.md` (gates **C0–C15**). Execute **exactly one** coherent gate per commit on `cursor/v1-final-contract-reconciliation-5907`. Do not combine adjacent gates. Do not push to `main`. The R0–R9 table below is historical context for the selected base; it is not the active ship program.

Historical remediation record (do not reopen as the ship program):

| Order | Slice / lane id | Goal | Branch pattern |
|------:|-----------------|------|----------------|
| **R0** | `v1-r0-release-baseline` | Restore honest release baseline: fix js-verify + playwright, capture supabase root cause, doc rewrites, camera copy, version 1.7.0, `testflight` EAS profile with test ads, build-provenance surface | `cursor/v1-r0-release-baseline-*` |
| **R1** | `v1-r1-review-ledger-rotation` | Forward-only migration: reward ledger idempotency on `(user_id, source_type, source_id)`, 5 PM NY rotation ownership, DST, `p_as_of`, exactly-once close/grant, empty/under-10 pool behavior | `cursor/v1-r1-review-ledger-rotation-*` |
| **R2** | `v1-r2-review-corpus-import` | Explicit corpus registry, importer with reject manifest, deduped content hashes, reviewed-item retirement, training/eval exclusion enforcement | `cursor/v1-r2-review-corpus-import-*` |
| **R3** | `v1-r3-review-product-ui` | Mobile Review workflow (Today's 10, confirm/edit/skip/report) + admin adjudication console + server-enforced eligibility | `cursor/v1-r3-review-product-ui-*` |
| **R4** | `v1-r4-consent-media-deletion` | Consent write authorization from `auth.uid()`, withdrawal, 30-day linked-data deletion with proof, real speech + photo capture | `cursor/v1-r4-consent-media-deletion-*` |
| **R5** | `v1-r5-monetization-device-proof` | Interstitial safe opportunities, foreground timer since last impression, offline path, rewarded SSV, RevenueCat sandbox matrix | `cursor/v1-r5-monetization-device-proof-*` |
| **R6** | `v1-r6-model-ship` | Neural EN→NE quality lift + new private uncontaminated holdout, without lowering frozen thresholds | `cursor/v1-r6-model-ship-*` |
| **R7** | `v1-r7-ui-testing-ground` | Mobile / iPad UI polish and Windows testing-ground scenario coverage | `cursor/v1-r7-ui-testing-ground-*` |
| **R8** | `v1-r8-production-ops` | Deploy migrations, Edge functions, cron, backups, legal URLs, alerts on staging + rehearsed rollback | `cursor/v1-r8-production-ops-*` |
| **R9** | `release/1.7.0-rc*` | Produce and test the production release candidate; device matrix; external cohort ≥ seven stable NY rotations | `release/1.7.0-rc*` |

**Dependency rule:** core translation must not depend on Supabase, AdMob, RevenueCat, or admin. Optional services fail soft.

**Do not mix** a core quality lane (1–5) and a V1 contract gate in the same PR.

Prior F0–F10, G0–G7, and R0–R9 plans remain source history. Do not reopen them as the ship program. Conflicting product text yields to INTENT, the decision table in `V1_G0_DECISIONS.md`, and `plans/active/v1-final-contract-reconciliation.md`.

Not autonomous (human-gated, still valid): TestFlight on physical iPhone/iPad; overnight GPU FT on the founder machine; Apple/Supabase/AdMob/RevenueCat console setup; legal copy; bilingual Nepali content sign-off; live interstitial enablement; hosted cron provisioning. Record those as blockers, do not invent results.

## Hard rules

- Scope: EN↔NE only, Expo iOS/iPadOS, on-device STT+MT and on-device camera OCR for the product path, no PC/cloud inference for core translate or OCR. Temporary Camera files are deleted after retake, exit, or successful processing. Do not request photo-library access unless importing existing images is added later.
- One model family (IndicTrans2 dist-200M), not four register models. Informal = **तिमी**, not तँ.
- Never train on `benchmarks/gold/`. Never edit gold references to raise a score.
- **Never** build contributor known-check sets from `benchmarks/gold/`, training holdouts, or private evaluation answers. Known checks are separately curated synthetic backend/admin seed data only.
- Public-review eligibility is deny-by-default. Training and benchmark rows need resolved provenance, license, and public-display rights. Collected rows need a certified anonymization record. Unresolved rights are `admin_only`. Publicly exposed source and target hashes are excluded from train and eval exports. Do not edit gold references to feed the review pool.
- Expo SDK **57** docs only for this release: https://docs.expo.dev/versions/v57.0.0/
- First launch is bilingual Terms + Privacy acceptance and a language choice. It does not require an account or an 18+ attestation. The 18+ attestation is the signed-in contribution gate for public review and media sharing.
- Login is required for **contribution, purchase, and restore** — never for translation, camera, history, settings, or Learn.
- Authenticated sessions expire after **30 days** of inactivity. Expiry must not disable guest core surfaces.
- Guest / signed-out / consent-declined translation history, microphone audio, transcripts, clipboard, and photos stay local. After current contribution consent, 18+, a valid session, and the matching default-off toggle, eligible speech recordings and Camera photos may upload when the remote flag is on. Never upload for guests, under-18, declined or outdated consent, signed-out, expired sessions, or flag-off states.
- Never put service/secret keys in the app bundle or admin browser code.
- Monetization boundary: **USD 2.99/month** (US storefront) and **NPR 199/month** (Nepal storefront), shown as StoreKit/RevenueCat's localized price; banners only idle Translate + idle Learn; automatic interstitial after **15 minutes** of foreground-active time since the last confirmed impression, **no daily cap**, only at Translate Send, Camera capture, and Learn activity-complete safe points; rewarded video = **2 credits / 30 ad-free minutes**; **1 credit = 15 minutes**; review rewards are **2 credits** (≤20 original source words) or **4 credits** (≥21), snapshotted at assignment; close at **5:00 PM America/New_York**; private lookahead minimum 14 days, target 28; one shared Today's 10 window; automated V1 validation logs a cosine score and returns **PASS**; timely human unsatisfactory prevents reward; no credit clawback; no automatic training from contributions; RevenueCat identity = Supabase UUID; TestFlight ads are Google test units and produce no revenue.
- Compiling is not Done. See `.agent/DONE.md`.
- After implementation, run `/independent-reviewer` in a fresh context. Findings become work items.
- Advance to the next V1 gate only with green gates and no material independent-review findings.

## Persistence

| File | Job |
|------|-----|
| `.governance/INTENT.md` | What the product is |
| `.governance/V1_G0_DECISIONS.md` | Living decision table; 2026-09-22 freeze kept as history |
| `.governance/DATA_CLASSIFICATION.md` | Deny-by-default review/train/benchmark eligibility |
| `training/ARCHITECTURE.md` | How MT is supposed to work |
| `AGENTS.md` | How an AI behaves here |
| `.agent/PLANS.md` | ExecPlan contract |
| `.agent/V1_FINAL_CONTRACT_STATE.md` | C0–C15 progress (status, SHA, next action) |
| `plans/active/v1-final-contract-reconciliation.md` | Active V1 ship contract (C0–C15) |
| `plans/active/v1-testflight-runbook.md` | Historical R0–R9 log |
| `plans/active/v1-testflight-finalization.md` | Historical G0–G7 log |
| `plans/active/beta-release.md` | Historical F0–F10 foundation log |
| `docs/NepTranslate_V1_Finalization_and_TestFlight_Runbook_71c85df.md` | 2026-09-22 external audit that opened R0–R9 |
| `benchmarks/gold/` + `mobile` verify scripts | How you prove translation quality |

When a lesson should stick, add a short rule here or in `.cursor/rules/` — do not rely on chat memory.
