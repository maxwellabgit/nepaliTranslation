# Bola

### In Nepali: बोल (Bola) is the imperative form of the verb "to speak" or "to talk." It means "Speak!" or "Voice."

**Offline, on-device English ↔ Nepali translation for iOS and iPadOS.** Speech recognition, machine translation, and Camera OCR run on the device. Optional account, review, ads, and subscription services fail soft and are never required for Translate, Camera, local history, Settings, or Learn.

Develop on Windows. Ship via Expo EAS → TestFlight / App Store. TestFlight uses Google test ad units and produces **no revenue**.

Public review updates are off. Today's 10 uses the sample set shipped with the app (at least 150 samples). The app records when someone passes 90% of that allotment. It does not download a new review window or run an automatic review score.

## Product

Public UI languages are English and Nepali. Primary surfaces are **Translate**, **Camera**, and **Learn**. Conversation stays inside Translate. Account is a section of Settings, not a fourth tab.

| Surface | What it does |
|---------|----------------|
| **Translate** | Type or speak. English ↔ Nepali, including multi-turn exchange, without an account. |
| **Camera** | Portrait on-device photo translation in both directions. Each sentence keeps one correlation color on the image and in the text below the image. |
| **Learn** | Offline Nepali alphabet. |

**Today's 10** (subtitle: Review translations) uses bundled local samples, category progress and Extra 10 completion badges. It awards no ad-free review credits. Eligible responses and speech/typed-result feedback must be captured privately and retrievable; the current source does not yet prove those complete journeys. Confirm/edit count distinct meanings toward a strict **>90%** metric; the metric is separate from actual answer capture.

The first installation open grants **10 credits** (100 minutes), replacing that day's daily award; each later New York date grants **5** (50 minutes). Preserve leftover time up to 12 hours. Gauge full mark is 50 unprinted credits, not an earning cap; full inner fill turns red without changing the pill/clock.
**Subscription target:** USD 2.99/month on the United States storefront and NPR 199/month on the Nepal storefront. The app shows the localized StoreKit/RevenueCat price.

**Register:** Formal / informal Nepali uses `तपाईं` vs `तिमी`. Informal is तिमी, not तँ.

UI improvements require current physical iPhone 16 screenshots, one separate image agent per proposal, and owner review. See [native baseline intake](docs/design/v1-ui/README.md). [Pivot inventory](docs/V1_PIVOT_INVENTORY.md) distinguishes source from missing capture/retrieval proof.

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
npx eas build --platform ios --profile testflight
npx eas submit --platform ios --profile testflight --id <EAS_BUILD_ID>
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

## Today's 10 lineup (bundled local behavior; native proof pending)

The review pool CSV has 378 meanings and 1,512 rows (four forms of each meaning). That lines up **37 days** of 10 in English, 10 in Devanagari, and 10 in Romanized. Eight leftover meanings are not a full day, so they are not scheduled. Days are not repeated.

- A user who never sees the first sample of any category stays on that day's set. Unseen samples are not thrown out.
- Seeing one sample, even with no review submitted, rotates that user to the next day. Category coins are local completion badges; there are no review-earned ad-free credits.
- A user who never opens Today's 10 still gets the first-open welcome and the daily credit award.
- The first time the app opens, the award is **10 credits** (100 minutes). Each later New York day, the first open awards **5 credits** (50 minutes). Time still left is kept, up to 12 hours.
- First-open welcome cards are the list in `mobile/src/features/contribution/openWelcome.ts`. Append a card to extend the welcome.
- After the welcome on a first open, and on later days with nothing ahead of it, a popup uses the three category pictures and advertises the ad-free pass. The offer is a placeholder. The credit award animation starts when that last popup closes.
- Finishing a category's 10 puts one gold coin at the bottom right of that card and unlocks **Extra 10** for that category only. Extra 10 is the next day's 10 for that category.
- Finishing the Extra 10 puts a second gold coin on that card. Those samples are spent, so the next day does not show them again.
- Skipping Extra 10 and waiting for the next day puts the user back on the same set as everyone else.
