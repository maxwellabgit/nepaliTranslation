# NepTranslate — agent operating system

Offline iOS English ↔ Nepali translator (`mobile/`). Intent lives in [`.governance/INTENT.md`](.governance/INTENT.md). Architecture lives in [`training/ARCHITECTURE.md`](training/ARCHITECTURE.md). Gold eval lives in [`benchmarks/gold/`](benchmarks/gold/).

A fresh agent must be able to enter this repo and know the product, the current lane, remaining work, and how to prove Done. Chat is disposable. These files are not.

## Read before you touch code

1. This file
2. `.governance/INTENT.md`
3. `.agent/LOOP.md` and `.agent/DONE.md`
4. The **one** active plan for your line of effort under `plans/active/`

Do not mix lanes in one run or one PR.

## Lines of effort (rank order)

Ranked by likelihood that an autonomous agent produces a real, checkable improvement in **this** repo. Each line is a separate agent, a separate ExecPlan, and a separate PR.

| Rank | Lane | Why it works here | Launch |
|------|------|-------------------|--------|
| **1** | Eval integrity | Gold is already the ship gate. Schema, leakage, register purity, and freeze checks are file-based and numeric. If gold is dirty, every accuracy claim is false. | `/eval-steward` |
| **2** | UI bug hunt | The product is two large Expo screens plus overlays. Most bugs are in source. `npm run verify:translate` is the cheap gate. Device-only bugs are listed, not faked. | `/ui-hunter` |
| **3** | Translation accuracy (decode path) | Phrase overlay, romanize, mashup refusal, and lexicon already have scripts. Improve JS/TS MT **without** editing gold answers. Gold scores are the gate. | `/mt-accuracy` |
| **4** | App runtime / efficiency | Warm-up, cancel, STT stop, pass-the-phone, fallbacks are in-repo. Real UX wins; slightly more judgment than 1–3. | `/app-runtime` |
| **5** | Model / on-device ship | Fine-tune, ONNX export, TestFlight weights. Industry-standard, but needs GPU/artifacts a cloud box often lacks. Honest blockers beat fake training. | `/model-ship` |

Do **not** start lane 5 until lane 1 is clean. Do **not** claim translation quality from UI-only diffs.

### Speech follow-on tracks

After lanes 1–3, spoken input/output is the next product hole. Each has its own ExecPlan. A founder may ask one agent to run several of these in one PR.

| Track | Lane | Why | Launch |
|-------|------|-----|--------|
| **A** | English speech offline | Apple English STT is already shipped; flip to on-device first + honest Settings. No GPU. | `/en-speech-offline` |
| **B** | App runtime | Warm-up, overlay vs `active`, cancel, Pass. | `/app-runtime` |
| **C** | Nepali STT | whisper.rn + Dragneel ggml. Scaffold + fetch script here; live mic needs EAS + weights. | `/ne-stt` |
| **D** | Nepali TTS | Bundled on-device Nepali voice, not `expo-speech` `ne-NP`. Piper/MMS is a hardware/asset blocker. | `/ne-tts` |

Do not claim Nepali mic or Nepali speak-aloud works without the native module and the model/voice on a phone. Typed fallback is the honest path.

Not autonomous (human-gated, still valid): TestFlight on a physical iPhone; overnight GPU FT on the founder machine. Record those as blockers, do not invent results.

## Hard rules

- Scope is v1: EN↔NE only, Expo iOS, on-device STT+MT, no camera, no PC/cloud inference in the product path.
- One model family (IndicTrans2 dist-200M), not four register models. Informal = **तिमी**, not तँ.
- Never train on `benchmarks/gold/`. Never edit gold references to raise a score.
- Expo SDK **57** docs only: https://docs.expo.dev/versions/v57.0.0/
- Compiling is not Done. See `.agent/DONE.md`.
- After implementation, run `/independent-reviewer` in a fresh context. Findings become work items.

## Persistence

| File | Job |
|------|-----|
| `.governance/INTENT.md` | What the product is |
| `training/ARCHITECTURE.md` | How MT is supposed to work |
| `AGENTS.md` | How an AI behaves here |
| `.agent/PLANS.md` | ExecPlan contract |
| `plans/active/<lane>.md` | Where this mission is |
| `benchmarks/gold/` + `mobile` verify scripts | How you prove it |

When a lesson should stick, add a short rule here or in `.cursor/rules/` — do not rely on chat memory.
