# Offline iOS path

Ship a fully on-device English ↔ Nepali translator on iPhone. Develop on Windows; no Mac required day-to-day. Core loop: mic or keyboard → on-device STT → on-device MT → text on screen.

## Stack

```
Windows (dev)  →  EAS cloud build  →  TestFlight  →  iPhone
                      │
                      ├─ STT: whisper.rn (ggml Whisper small / quantized)
                      └─ MT:  ONNX Runtime mobile (IndicTrans2 en↔ne)
```

| Layer | Choice | Notes |
|-------|--------|--------|
| App shell | Expo (`mobile/`) | Normal + Conversation UI; EAS for iOS IPA |
| Speech-to-text | [whisper.rn](https://github.com/mybigday/whisper.rn) | Bundle ggml `small` or `small-q5_1` for EN + Nepali |
| Translation | ONNX Runtime for React Native | IndicTrans2-class merged checkpoints, exported to ONNX |
| Ship | EAS Build → TestFlight | Apple Developer required |

Expo is the app shell; native modules (whisper.rn, ONNX) are expected for inference.

## Model artifacts

Weights live in the app, not on a PC:

| Location | When |
|----------|------|
| `mobile/assets/models/` | Bundled in release IPA (Whisper ggml, ONNX graphs + tokenizers) |
| Download on first launch | Large artifacts fetched once, then cached on device |

Export flow (dev machine, one-time or per release):

1. **Whisper** — ggml `small` or `small-q5_1` via [whisper.cpp](https://github.com/ggerganov/whisper.cpp) scripts; copy into `mobile/assets/models/whisper/`.
2. **IndicTrans2** — export merged EN→NE and NE→EN checkpoints to ONNX (encoder/decoder + tokenizer files). See [`scripts/prepare_offline_models.md`](../scripts/prepare_offline_models.md) for export commands; copy results into `mobile/assets/models/it2_en_indic/` and `it2_indic_en/`.
3. Wire paths in the Expo native layer; smoke-test on a device build before TestFlight.

Fine-tuned checkpoints from [`training/`](../training/) follow the same export → `mobile/assets/models/` path.

## Windows → TestFlight checklist

1. Prepare ggml Whisper + ONNX IT2 artifacts under `mobile/assets/models/` (or implement first-launch download).
2. `npx eas build --platform ios --profile production` from `mobile/`.
3. `npx eas submit --platform ios --latest` → install via TestFlight.
4. Verify offline: airplane mode, Normal + Conversation, Formal / Informal on EN→NE.

App setup details: [`mobile/README.md`](../mobile/README.md).

## Formal / informal

| Phase | Behavior |
|-------|----------|
| **Now** | UI **Formal / Informal** toggle on EN→NE. Models or post-processing apply `तपाईं` vs `तिमी` register where supported. |
| **Next** | Separate formal / informal IT2 checkpoints (or adapters); ship both ONNX graphs; toggle selects model. |
| **Eval** | Gold class `en_ne_formal` / `en_ne_informal` under [`benchmarks/gold/`](../benchmarks/gold/); honorific probe for quick register checks. |

## Quality gate

**Primary:** private **gold standard** — ~100 curated samples per class:

| Class | Direction / input |
|-------|-------------------|
| `en_ne_formal` | English → Nepali (formal register) |
| `en_ne_informal` | English → Nepali (informal register) |
| `ne_en_deva` | Nepali Devanagari → English |
| `ne_en_roman` | Romanized Nepali → English |

Scaffold and curation guide: [`benchmarks/gold/`](../benchmarks/gold/).

Any on-device MT build must meet or beat the frozen gold baseline before shipping. Do not use FLORES alone as the ship gate.

**Secondary / legacy:** corpus-scale suites (`benchmarks/run_ne_quality_bench.py`, `benchmarks/run_mt_bench.py`) for regression signal during training — see [`benchmarks/README.md`](../benchmarks/README.md).

## Out of scope (v1)

- PC hybrid backend, tunnels, cloud translation APIs
- Camera / OCR
- Hindi or other Nepal languages as product languages
- Speaker diarization (“Speaker 1 / 2”) — single-stream transcript is enough for v1
