# NepTranslate — agent operating system

Offline-first iOS / iPadOS English ↔ Nepali translator (`mobile/`). Intent lives in [`.governance/INTENT.md`](.governance/INTENT.md). Architecture lives in [`training/ARCHITECTURE.md`](training/ARCHITECTURE.md). Gold eval lives in [`benchmarks/gold/`](benchmarks/gold/). Production V1 finalization lives in [`plans/active/beta-release.md`](plans/active/beta-release.md) (slices **F0–F10**).

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

### Production V1 finalization (dependency order)

Full-business V1 (monetized, consented media, certified) uses **one** living ExecPlan: `plans/active/beta-release.md`.

Execute **exactly one** slice per branch/PR. Do not combine adjacent slices because context remains. Do not start F1+ until F0 is merged and independent review is clean.

| Order | Slice / lane id | Goal | Branch pattern |
|------:|-----------------|------|----------------|
| **F0** | `v1-f0-contract` | Durable product contract (docs only) | `cursor/v1-f0-product-contract` |
| **F1** | `v1-f1-privacy-core` | STT privacy, log scrub, model pins, Camera stability | `cursor/v1-f1-privacy-core` |
| **F2** | `v1-f2-ui` | Bilingual UI, dark mode, a11y, iPhone+iPad layouts | `cursor/v1-f2-ui` |
| **F3** | `v1-f3-media` | Consented speech/photo ingestion + private storage | `cursor/v1-f3-media` |
| **F4** | `v1-f4-rewards` | 5 PM NY reward close, alerts, 30-day deletion | `cursor/v1-f4-rewards` |
| **F5** | `v1-f5-ads` | Banners, interstitials, rewarded, ad-policy tests | `cursor/v1-f5-ads` |
| **F6** | `v1-f6-iap` | RevenueCat / StoreKit $0.99 subscription | `cursor/v1-f6-iap` |
| **F7** | `v1-f7-admin` | Protected operational admin console | `cursor/v1-f7-admin` |
| **F8** | `v1-f8-store` | Telemetry, legal/store, security, dependency triage | `cursor/v1-f8-store` |
| **F9** | `v1-f9-cert` | Exact model certification + Windows automation | `cursor/v1-f9-cert` |
| **F10** | `v1-f10-release` | Device matrix, TestFlight, App Store gates | `cursor/v1-f10-release` |

**Dependency rule:** core translation must not depend on Supabase, AdMob, RevenueCat, or admin. Optional services fail soft.

**Do not mix** a core quality lane (1–5) and a V1 finalization slice in the same PR.

Prior beta foundation (slices 00–08 / H0–H6) and Windows production-readiness work through `9b17ac9` remain the source baseline. Do not reopen that program; supersede conflicting product-boundary text with INTENT + F0–F10.

Not autonomous (human-gated, still valid): TestFlight on physical iPhone/iPad; overnight GPU FT on the founder machine; Apple/Supabase/AdMob/RevenueCat console setup; legal copy; bilingual Nepali content sign-off; live interstitial enablement. Record those as blockers, do not invent results.

## Hard rules

- Scope: EN↔NE only, Expo iOS/iPadOS, on-device STT+MT and on-device camera OCR for the product path, no PC/cloud inference for core translate or OCR. Temporary Camera files are deleted after retake, exit, or successful processing. Do not request photo-library access unless importing existing images is added later.
- One model family (IndicTrans2 dist-200M), not four register models. Informal = **तिमी**, not तँ.
- Never train on `benchmarks/gold/`. Never edit gold references to raise a score.
- **Never** build contributor known-check sets from `benchmarks/gold/`, training holdouts, or private evaluation answers. Known checks are separately curated backend/admin seed data only.
- Expo SDK **57** docs only for this release: https://docs.expo.dev/versions/v57.0.0/
- Login is required for contributions and rewards only — never for translation, camera, history, settings, or Learn alphabet.
- Ordinary guest / non-consenting translation history, microphone audio, transcripts, clipboard, and photos stay local. **After** 18+ versioned contribution consent, eligible speech and Camera captures may upload automatically when flags allow. Never upload for guests, under-18, declined/outdated consent, signed-out, or flag-off states.
- Never put service/secret keys in the app bundle or admin browser code.
- Monetization boundary: **$0.99/month** ad-free subscription; banners only idle Translate + Learn landing; automatic interstitial 15 min / max 3 per `America/New_York` day at safe idle transitions (SDK-owned dismiss; remotely disableable); rewarded video = **15** ad-free minutes; one credit = **five** minutes; >20 original words = two credits; reward close **5:00 PM America/New_York**; no credit clawback; no automatic training from contributions.
- Compiling is not Done. See `.agent/DONE.md`.
- After implementation, run `/independent-reviewer` in a fresh context. Findings become work items.
- Advance to the next V1 slice only with green gates and no material independent-review findings.

## Persistence

| File | Job |
|------|-----|
| `.governance/INTENT.md` | What the product is |
| `training/ARCHITECTURE.md` | How MT is supposed to work |
| `AGENTS.md` | How an AI behaves here |
| `.agent/PLANS.md` | ExecPlan contract |
| `plans/active/<lane>.md` | Where this mission is |
| `plans/active/beta-release.md` | V1 finalization (F0–F10) + proof log |
| `benchmarks/gold/` + `mobile` verify scripts | How you prove translation quality |

When a lesson should stick, add a short rule here or in `.cursor/rules/` — do not rely on chat memory.
