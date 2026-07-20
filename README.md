# NepTranslate

**Offline, on-device English ↔ Nepali translation for iOS.** Speech recognition and machine translation run entirely on the iPhone — no server, tunnel, or PC backend.

Develop on Windows. Ship to iPhone via Expo EAS → TestFlight / App Store.

## Product

| Mode | What it does |
|------|----------------|
| **Normal** | Type or speak. Auto-detect Nepali or English; translate to the other language. Mic + keyboard on one screen. |
| **Conversation** | Face-to-face handoff. One **Handoff** control (whose turn / language) and one **Speak** control. Translated text is shown large; history scrolls upward like a chat. |

**Register:** When English input produces Nepali output, a **Formal / Informal** toggle controls register (`तपाईं` vs `तिमी` style).

**Script:** Devanagari and Romanized Nepali input where supported (Roman is normalized before MT when needed).

## Docs

| Topic | Path |
|-------|------|
| App setup, build, TestFlight | [`mobile/README.md`](mobile/README.md) |
| TestFlight updates | [`mobile/TESTFLIGHT.md`](mobile/TESTFLIGHT.md) |
| On-device models (whisper.rn + ONNX IndicTrans2) | [`docs/OFFLINE_IOS.md`](docs/OFFLINE_IOS.md) |
| Quality gate (gold standard, ~100 samples/class) | [`benchmarks/gold/`](benchmarks/gold/) |
| Benchmarks overview | [`benchmarks/README.md`](benchmarks/README.md) |

Authoritative product intent: [`.governance/INTENT.md`](.governance/INTENT.md).

## Ship (Windows → TestFlight)

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
```
