# NepTranslate

**Offline English ↔ Nepali companion for iOS.** Develop on Windows; ship via Expo EAS → TestFlight.

**What ships today (1.4.5):** offline **phrasebook + lexicon** MT + **Apple** speech recognition. Neural IndicTrans2 (ONNX) and whisper.rn are the **2.0 / 2.1** path — see [`mobile/docs/V2_FLEET_DECISION.md`](mobile/docs/V2_FLEET_DECISION.md).

## Product

| Mode | What it does |
|------|----------------|
| **Auto** | Type or speak. Auto-detect Nepali or English; translate to the other language. |
| **Conversation** | Face-to-face handoff. **Pass** finalizes and flips side. |

**Register:** Formal / Informal for English→Nepali.  
**Script:** Devanagari / Roman Nepali.

## Docs

| Topic | Path |
|-------|------|
| App setup / TestFlight | [`mobile/README.md`](mobile/README.md), [`mobile/TESTFLIGHT.md`](mobile/TESTFLIGHT.md) |
| v2 fleet decision | [`mobile/docs/V2_FLEET_DECISION.md`](mobile/docs/V2_FLEET_DECISION.md) |
| Device checklist | [`mobile/docs/V2_DEVICE_CHECKLIST.md`](mobile/docs/V2_DEVICE_CHECKLIST.md) |
| Offline model target path | [`docs/OFFLINE_IOS.md`](docs/OFFLINE_IOS.md) |
| Gold quality gate | [`benchmarks/gold/`](benchmarks/gold/) |
| Product intent | [`.governance/INTENT.md`](.governance/INTENT.md) |

## Tests

```powershell
cd mobile
npm test
```

## Ship (Windows → TestFlight)

```powershell
cd mobile
npx eas build --platform ios --profile production --auto-submit
```

## Repo layout

```
mobile/          Expo iOS app (product surface)
docs/            Offline model target path
benchmarks/      Gold-standard eval
training/        IT2 fine-tune for future on-device export
.governance/     INTENT
```
