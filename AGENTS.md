# NepTranslate — agent operating system

Offline-first iOS English ↔ Nepali translator (`mobile/`). Intent lives in [`.governance/INTENT.md`](.governance/INTENT.md). Architecture lives in [`training/ARCHITECTURE.md`](training/ARCHITECTURE.md). Gold eval lives in [`benchmarks/gold/`](benchmarks/gold/). App Store / TestFlight beta program lives in [`plans/active/beta-release.md`](plans/active/beta-release.md).

A fresh agent must be able to enter this repo and know the product, the current lane, remaining work, and how to prove Done. Chat is disposable. These files are not.

## Read before you touch code

1. This file
2. `.governance/INTENT.md`
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

### Beta release lanes (dependency order)

App Store / TestFlight work uses **one** living ExecPlan: `plans/active/beta-release.md`.

**Foundation hardening (H0–H6):** work on **`main`**. Do not open Slice 09+ until H0–H6 pass independent review and the foundation merge gates. One hardening milestone per session. After the foundation is accepted, return to exactly one beta slice per branch/PR.

Execute **exactly one** slice per branch/PR for Slice 09 onward. Do not combine adjacent slices because context remains.

| Order | Slice / lane id | Goal | Branch pattern |
|------:|-----------------|------|----------------|
| **00** | `beta-00-contract` | Durable product contract (docs only) | `cursor/beta-00-product-contract` |
| **01** | `beta-01-harness` | Jest/RTL harness, UI primitives, CI mobile gate | `cursor/beta-01-test-harness` |
| **02** | `beta-02-backend` | Supabase schema, RLS, API skeleton, similarity | `cursor/beta-02-supabase-skeleton` |
| **03** | `beta-03-auth` | Sign in with Apple, consent, account deletion | `cursor/beta-03-apple-auth` |
| **04** | `beta-04-outbox` | Correction sheet + offline outbox; remove temp sync/secret | `cursor/beta-04-correction-outbox` |
| **05** | `beta-05-queue` | Contribution queue, known checks, consensus | `cursor/beta-05-contribution-queue` |
| **06** | `beta-06-rewards` | Reward ledger, entitlements, ad-policy pure fn | `cursor/beta-06-reward-ledger` |
| **07** | `beta-07-learn` | Learn alphabet tab (offline) | `cursor/beta-07-learn-alphabet` |
| **08** | `beta-08-ads` | AdMob adapter + middleware (dev build) | `cursor/beta-08-admob` |
| **09** | `beta-09-iap` | RevenueCat / StoreKit ad-free subscription | `cursor/beta-09-revenuecat` |
| **10** | `beta-10-admin` | Protected admin web console | `cursor/beta-10-admin-console` |
| **11** | `beta-11-privacy` | Privacy, security, observability, store surfaces | `cursor/beta-11-privacy-store` |
| **12** | `beta-12-e2e` | Maestro E2E, performance, polish | `cursor/beta-12-e2e-polish` |
| **13** | `beta-13-release` | TestFlight + App Store release candidate | `cursor/beta-13-testflight-release` |

**Dependency rule:** core translation must not depend on Supabase, AdMob, RevenueCat, or admin. Optional services fail soft.

**Do not mix** a core quality lane (1–5) and a beta slice in the same PR.

Not autonomous (human-gated, still valid): TestFlight on a physical iPhone; overnight GPU FT on the founder machine; Apple/Supabase/AdMob/RevenueCat console setup; legal copy; bilingual Nepali content sign-off. Record those as blockers, do not invent results.

## Hard rules

- Scope: EN↔NE only, Expo iOS, on-device STT+MT and on-device camera OCR for the product path, no PC/cloud inference for core translate or OCR. Camera images stay in temporary cache and are deleted after retake, exit, or successful processing. Do not request photo-library access unless importing existing images is added later.
- One model family (IndicTrans2 dist-200M), not four register models. Informal = **तिमी**, not तँ.
- Never train on `benchmarks/gold/`. Never edit gold references to raise a score.
- **Never** build contributor known-check sets from `benchmarks/gold/`, training holdouts, or private evaluation answers. Known checks are separately curated backend/admin seed data only.
- Expo SDK **57** docs only for this release: https://docs.expo.dev/versions/v57.0.0/
- Login is required for contributions and rewards only — never for translation, camera, history, settings, or Learn alphabet.
- Never upload ordinary translation history, microphone audio, speech transcripts, or clipboard automatically.
- Never put service/secret keys in the app bundle or admin browser code.
- Compiling is not Done. See `.agent/DONE.md`.
- After implementation, run `/independent-reviewer` in a fresh context. Findings become work items.
- Advance to the next beta slice only with green gates and no material independent-review findings.

## Persistence

| File | Job |
|------|-----|
| `.governance/INTENT.md` | What the product is |
| `training/ARCHITECTURE.md` | How MT is supposed to work |
| `AGENTS.md` | How an AI behaves here |
| `.agent/PLANS.md` | ExecPlan contract |
| `plans/active/<lane>.md` | Where this mission is |
| `plans/active/beta-release.md` | Beta slice pointer + proof log |
| `benchmarks/gold/` + `mobile` verify scripts | How you prove translation quality |

When a lesson should stick, add a short rule here or in `.cursor/rules/` — do not rely on chat memory.
