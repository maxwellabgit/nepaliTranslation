# BOLA

### In Nepali: बोल (Bola) is the imperative form of the verb "to speak" or "to talk." It means "Speak!" or "Voice."

**Offline, on-device English ↔ Nepali translation for iOS and iPadOS.** Speech recognition, machine translation, and Camera OCR run on the device. Optional account, review, ads, and subscription services fail soft and are never required for Translate, Camera, local history, Settings, or Learn.

Develop on Windows. Ship via Expo EAS → TestFlight / App Store. TestFlight uses Google test ad units and produces **no revenue**.

> **Temporary V1 review validation: always PASS.** The daily automated review job must log a real deterministic local cosine-similarity score and still return PASS for every substantive submission. A human admin can mark a submission unsatisfactory before the 5:00 PM `America/New_York` close; that decision overrides PASS and prevents the reward. A late rejection does not revoke credits. This always-PASS behavior is temporary and must stay visible in this README, `automations/README.md` (added in a later gate), the admin UI, and code comments. Do not add an external model just to compute the score.

## Product

Public UI languages are English and Nepali. Primary surfaces are **Translate**, **Camera**, and **Learn**. Conversation stays inside Translate. Account is a section of Settings, not a fourth tab.

| Surface | What it does |
|---------|----------------|
| **Translate** | Type or speak. English ↔ Nepali, including multi-turn exchange, without an account. |
| **Camera** | Portrait on-device photo translation in both directions. Each sentence keeps one correlation color on the image and in the text below the image. |
| **Learn** | Offline Nepali alphabet. |

**Today's 10** (subtitle: Review translations) is the only public correction flow. Rewards settle at 5:00 PM `America/New_York`: **2 credits** for an original source of 0–20 words, **4 credits** for 21 or more. One credit is 15 ad-free minutes.

**Subscription target:** USD 2.99/month on the United States storefront and NPR 199/month on the Nepal storefront. The app shows the localized StoreKit/RevenueCat price.

**Register:** Formal / informal Nepali uses `तपाईं` vs `तिमी`. Informal is तिमी, not तँ.

Living contract: [`.governance/INTENT.md`](.governance/INTENT.md) and [`plans/active/v1-final-contract-reconciliation.md`](plans/active/v1-final-contract-reconciliation.md).

## Docs

| Topic | Path |
|-------|------|
| Agent lanes and the C0–C15 ship contract | [`AGENTS.md`](AGENTS.md) |
| Final contract reconciliation | [`plans/active/v1-final-contract-reconciliation.md`](plans/active/v1-final-contract-reconciliation.md) |
| Copy-paste launch prompts | [`.agent/LAUNCH.md`](.agent/LAUNCH.md) |
| App setup, build, TestFlight | [`mobile/README.md`](mobile/README.md) |
| TestFlight updates | [`mobile/TESTFLIGHT.md`](mobile/TESTFLIGHT.md) |
| On-device models (whisper.rn + ONNX IndicTrans2) | [`docs/OFFLINE_IOS.md`](docs/OFFLINE_IOS.md) |
| Quality gate (gold holdout; freeze ≠ phrasebook floor) | [`benchmarks/gold/`](benchmarks/gold/) |
| Benchmarks overview | [`benchmarks/README.md`](benchmarks/README.md) |

Authoritative product intent: [`.governance/INTENT.md`](.governance/INTENT.md).

## Ship (Windows → TestFlight)

Owner authorization is required before `eas build` or `eas submit`. The commands below are the documented path, not permission to submit. The internal TestFlight profile must keep Google test ad units. Do not treat a TestFlight build as live ad revenue.

```powershell
cd mobile
npx eas-cli login
npx eas build --platform ios --profile production
npx eas submit --platform ios --latest
```

See [`mobile/README.md`](mobile/README.md) for one-time Apple Developer + EAS setup.

## Repo layout

```
mobile/          Expo iOS app (product surface)
docs/            Offline model path and architecture notes
benchmarks/      Gold-standard eval + legacy corpus suites
training/        IT2 fine-tune for on-device ONNX export
.governance/     INTENT and steward prompts
AGENTS.md        How coding agents must work here
.agent/          Loop, Done, ExecPlan contract, launch prompts
plans/active/    One living plan per line of effort
.cursor/agents/  Subagents: one per lane + independent reviewer
```
