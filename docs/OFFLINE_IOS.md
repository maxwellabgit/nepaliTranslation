# Offline iOS path

Goal: ship a fully on-device Nepali ↔ English ambient translator on iPhone, developed primarily on Windows, without requiring a Mac day-to-day.

## Primary path: Expo + whisper.rn + ONNX IndicTrans2

```
Windows (dev)  →  EAS cloud build  →  TestFlight  →  iPhone
                      │
                      ├─ STT: whisper.rn (ggml Whisper small)
                      └─ MT:  ONNX Runtime mobile (IndicTrans2 en↔indic)
```

| Layer | Choice | Notes |
|-------|--------|--------|
| App shell | Expo (`mobile/`) | Mic + UI; EAS for iOS IPA |
| Speech-to-text | [whisper.rn](https://github.com/mybigday/whisper.rn) | Bundle ggml `small` (or quantized) for EN + Nepali |
| Translation | ONNX Runtime for React Native | Export merged IT2 dirs under `experiments/models/` — see [`scripts/prepare_offline_models.md`](../scripts/prepare_offline_models.md) |
| Ship | EAS Build → TestFlight | Apple Developer required; no local Xcode on Windows |

Hybrid PC-backend mode (`web/serve.py` + tunnel) remains useful for UI iteration. Offline GA means mic → whisper.rn → ONNX IT2 entirely on device.

### Windows → TestFlight checklist

1. Prepare ggml Whisper + ONNX IT2 artifacts (`scripts/prepare_offline_models.md`).
2. Wire models into the Expo app (assets / download-on-first-launch).
3. `npx eas build --platform ios --profile production` from `mobile/`.
4. `npx eas submit --platform ios --latest` → install via TestFlight.

Details for the current hybrid app live in [`mobile/README.md`](../mobile/README.md).

## Mac moonshot: speech-swift

Native Apple stack (Speech framework / custom Core ML ASR wrappers, SwiftUI shell in `NepTranslate/`) is a **Mac-only moonshot**: better system integration and Neural Engine path, but blocks Windows-first iteration. Keep the Swift project as a reference; do not block the Expo offline path on it.

## Formal / informal plan

| Phase | Behavior |
|-------|----------|
| **Now (stopgap)** | `Formality` on `/translate` and `TranslationManager.translate()`. Informal EN→NE applies a lightweight तपाईं→तिमी surface rewrite. NE→EN unchanged. |
| **Next** | Fine-tune or distill separate EN→NE formal / informal IT2 (or adapter) checkpoints; ship both ONNX graphs; UI toggle selects model (mirrors Swift `FormalityStyle`). |
| **Eval** | Qualitative checks via `benchmarks/honorific_probe.json` (तपाईं vs तिमी markers). Do not use FLORES for register quality. |

## Diarization moonshot

Speaker labels (“Speaker 1 / 2”) for ambient conversation are **out of MVP scope**. Candidate later work: lightweight on-device embedding diarization (e.g. ECAPA-style) or Apple speaker segmentation APIs if exposed. Until then, single-stream transcript is enough.

## Benchmark gate (ship blocker)

Any offline MT build (desktop PyTorch, ONNX mobile, or quantized) must **meet or beat** the frozen FLORES baseline on **n=50**:

| Artifact | Path |
|----------|------|
| Baseline | [`benchmarks/results/flores_baseline.json`](../benchmarks/results/flores_baseline.json) |
| Harness | `python benchmarks/run_mt_bench.py --n 50` |

**Pass rule:** for each primary direction present in the baseline (`ne-en`, `en-ne`, and optionally `hi-en` / `en-hi`), corpus **chrF++** must be ≥ baseline `chrf_plus_plus` (BLEU is secondary). Regressions block shipping that model artifact.

Snapshot (for orientation; always re-read the JSON):

| Direction | chrF++ | BLEU |
|-----------|--------|------|
| ne-en | 63.79 | 39.76 |
| en-ne | 51.87 | 36.35 |
| hi-en | 62.94 | 40.33 |
| en-hi | 55.47 | 39.23 |
