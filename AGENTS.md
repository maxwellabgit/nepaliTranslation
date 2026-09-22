# NepTranslate — agent operating system

Offline-first iOS / iPadOS English ↔ Nepali translator (`mobile/`). Intent lives in [`.governance/INTENT.md`](.governance/INTENT.md). Architecture lives in [`training/ARCHITECTURE.md`](training/ARCHITECTURE.md). Gold eval lives in [`benchmarks/gold/`](benchmarks/gold/). **Ship program:** TestFlight finalization gates **G0–G7** in [`plans/active/v1-testflight-finalization.md`](plans/active/v1-testflight-finalization.md). Contract freeze: [`.governance/V1_G0_DECISIONS.md`](.governance/V1_G0_DECISIONS.md). Prior F0–F10 source work is foundation only (see [`plans/active/beta-release.md`](plans/active/beta-release.md)).

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

### Production V1 TestFlight finalization (dependency order)

Full-business V1 readiness uses **one** living ExecPlan: `plans/active/v1-testflight-finalization.md`.

Execute **exactly one** gate per branch/PR. Do not combine adjacent gates. Do not start G1+ until G0 is merged and independent review is clean.

| Order | Slice / lane id | Goal | Branch pattern |
|------:|-----------------|------|----------------|
| **G0** | `v1-g0-contract` | Freeze corrected product contract (docs only) | `cursor/v1-g0-contract-freeze-*` |
| **G1** | `v1-g1-review-pool` | Global 10/day public-review pool, importer of all corpora, 5 PM rotation, admin adjudication | `cursor/v1-g1-review-pool-*` |
| **G2** | `v1-g2-consent-deletion` | Startup T&C + Privacy + 18+ gate, raw speech + photo upload, withdrawal, 30-day purge | `cursor/v1-g2-consent-deletion-*` |
| **G3** | `v1-g3-monetization` | Ads SDK events, impression timer, RevenueCat↔Supabase identity | `cursor/v1-g3-monetization-*` |
| **G4** | `v1-g4-model-device` | Exact ONNX cert + physical iPhone/iPad evidence | `cursor/v1-g4-model-device-*` |
| **G5** | `v1-g5-ops` | Hosted scheduler, secrets, legal URLs, alerts, backups | `cursor/v1-g5-ops-*` |
| **G6** | `v1-g6-internal-tf` | Internal TestFlight candidate, staged flags | `cursor/v1-g6-internal-tf-*` |
| **G7** | `v1-g7-external-v1` | External cohort ≥7 days + V1 go/no-go | `cursor/v1-g7-external-v1-*` |

**Dependency rule:** core translation must not depend on Supabase, AdMob, RevenueCat, or admin. Optional services fail soft.

**Do not mix** a core quality lane (1–5) and a V1 finalization gate in the same PR.

Prior F0–F10 (merged through `43f9bc6`) and beta foundation through `9b17ac9` remain source baseline. Do not reopen F-slices as the ship program; supersede conflicting boundary text with INTENT + G0 decisions.

Not autonomous (human-gated, still valid): TestFlight on physical iPhone/iPad; overnight GPU FT on the founder machine; Apple/Supabase/AdMob/RevenueCat console setup; legal copy; bilingual Nepali content sign-off; live interstitial enablement; hosted cron provisioning. Record those as blockers, do not invent results.

## Hard rules

- Scope: EN↔NE only, Expo iOS/iPadOS, on-device STT+MT and on-device camera OCR for the product path, no PC/cloud inference for core translate or OCR. Temporary Camera files are deleted after retake, exit, or successful processing. Do not request photo-library access unless importing existing images is added later.
- One model family (IndicTrans2 dist-200M), not four register models. Informal = **तिमी**, not तँ.
- Never train on `benchmarks/gold/`. Never edit gold references to raise a score.
- **Never** build contributor known-check sets from `benchmarks/gold/`, training holdouts, or private evaluation answers. Known checks are separately curated **synthetic** backend/admin seed data only.
- V1 public-review pool imports **all** training and benchmark corpora as eligible items (`public_review_eligible=true`) after PII/dedup. Public-review submissions must **not** be promoted back into `benchmarks/gold/` or training corpora until a separate verified migration is signed off.
- Expo SDK **57** docs only for this release: https://docs.expo.dev/versions/v57.0.0/
- Every user must accept the startup consent gate (T&C + Privacy Policy + "I am 18+") before reaching any product surface. Guests may then translate locally; signed-in users may additionally contribute.
- Login is required for **purchase, restore, contribution/public review, and rewards** — never for translation, camera, history, settings, or Learn alphabet.
- Guest / signed-out / consent-declined translation history, microphone audio, transcripts, clipboard, and photos stay local. After sign-in + startup consent, eligible **Camera photos**, **raw speech recordings**, and **public-review corrections** may upload when the matching flag is on. All uploaded data is tied to the signed-in `user_id`. Never upload for guests, signed-out, or flag-off states.
- Never put service/secret keys in the app bundle or admin browser code.
- Monetization boundary: **$0.99/month** ad-free subscription; banners only idle Translate + Learn landing; automatic interstitial **15 min since last successful impression** / max 3 per `America/New_York` day at safe idle transitions (SDK-owned dismiss; remotely disableable); rewarded video = **1 credit / 15 ad-free minutes**; **1 credit = 15 minutes**; top-50%-longest samples at assignment = 2 credits; reward grant at **5:00 PM America/New_York** rotation; **one global 10-item public-review window per NY day**; no credit clawback; no automatic training from contributions; RevenueCat identity = Supabase UUID.
- Compiling is not Done. See `.agent/DONE.md`.
- After implementation, run `/independent-reviewer` in a fresh context. Findings become work items.
- Advance to the next V1 gate only with green gates and no material independent-review findings.

## Persistence

| File | Job |
|------|-----|
| `.governance/INTENT.md` | What the product is |
| `.governance/V1_G0_DECISIONS.md` | Frozen audit decisions |
| `.governance/DATA_CLASSIFICATION.md` | Review/train/benchmark eligibility |
| `training/ARCHITECTURE.md` | How MT is supposed to work |
| `AGENTS.md` | How an AI behaves here |
| `.agent/PLANS.md` | ExecPlan contract |
| `plans/active/<lane>.md` | Where this mission is |
| `plans/active/v1-testflight-finalization.md` | G0–G7 ship program + proof log |
| `plans/active/beta-release.md` | Historical F0–F10 foundation log |
| `benchmarks/gold/` + `mobile` verify scripts | How you prove translation quality |

When a lesson should stick, add a short rule here or in `.cursor/rules/` — do not rely on chat memory.
