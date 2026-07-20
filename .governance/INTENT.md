# INTENT
Last updated: 2026-07-20

## North Star
An **offline, on-device iOS app** that translates **English ↔ Nepali** in real time for live conversation and everyday text. All speech recognition and translation run on the iPhone. No server, no PC backend, no cloud inference for the core loop. Developed on Windows; shipped to iPhone via Expo EAS → TestFlight / App Store.

## Product
**NepTranslate** — Nepali-first translation companion.

### Modes (v1 UI)
1. **Normal** — Type or speak. Auto-detect Nepali or English; translate to the other language. Mic + keyboard on one screen.
2. **Conversation** — Face-to-face handoff. One **Handoff** control (whose turn / language) and one **Speak** control. Translated text is shown large; history scrolls upward like a chat.

### Register
When the English speaker produces Nepali, a **Formal / Informal** toggle controls Nepali output (`तपाईं` vs `तिमी` style, with verb agreement as models allow).

### Script
Support **Devanagari** and **Romanized Nepali** input where feasible (normalize Roman → Devanagari before MT when needed).

## V1 Scope
- Languages: **English ↔ Nepali only** (NPHC 2021: Nepali is the national lingua franca; Maithili/Bhojpuri etc. are later).
- Surfaces: **Expo iOS app only** (`mobile/`).
- Inference: on-device STT + on-device MT (Whisper-class ASR + IndicTrans2-class MT, or successors that meet the gold bench).
- Output: text (+ optional TTS). No camera / OCR in v1.
- Quality gate: private **gold standard** set — ~100 high-quality samples per eval class (formal EN→NE, informal EN→NE, NE→EN Devanagari, Roman NE→EN).

## Goals (this iteration)
- [x] Single coherent offline product story in all docs and code
- [x] Normal + Conversation UI with bottom mode switch; no camera
- [x] Formal/Informal toggle for English→Nepali
- [x] Gold-standard benchmark scaffold (100/class) + curation guide
- [ ] Path to whisper.rn + on-device IndicTrans2 (ONNX/Core ML) without any PC runtime dependency
- [x] Remove web/hybrid/glasses/PC-server code from the repo

## Constraints
- Must: run fully offline for core translate after models are on device
- Must: ship iOS via Expo/EAS from Windows (no Mac required day-to-day)
- Must: EN↔NE only in v1
- Must not: require a PC, tunnel, or cloud API for translation/STT in the product path
- Must not: camera translate in v1
- Must not: smart glasses / Halo / Multipeer as current scope

## Not Doing (v1)
- PC hybrid Whisper/IndicTrans2 servers
- Web/Safari demo as a product surface
- Camera OCR
- Hindi or other Nepal languages as product languages
- Smart glasses / Brilliant Halo
- Swift-only rewrite (Expo is the app shell; native modules OK for inference)

## Definition of Done (v1 product coherence)
- Docs and INTENT describe only the offline iOS EN↔NE app
- App has Normal + Conversation modes as specified; camera gone
- No hybrid/server client code in `mobile/`
- Gold bench classes defined with 100-slot scaffolds and curation guide
- Offline model path documented without PC runtime

## Sensitive areas
- Apple Developer / EAS credentials
- Bundled model weights and licenses
- Private gold benchmark answers (do not publish if used as holdout)
