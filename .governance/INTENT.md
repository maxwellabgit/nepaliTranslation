# INTENT
Last updated: 2026-07-23

## North Star
An **offline, on-device iOS app** that translates **English ↔ Nepali** in real time for live conversation and everyday text. All speech recognition and translation run on the iPhone. No server, no PC backend, no cloud inference for the core loop. Developed on Windows; shipped to iPhone via Expo EAS → TestFlight / App Store.

## Product
**NepTranslate** — Nepali-first translation companion.

### Modes
1. **Auto** — Type or speak (equal prominence). Auto-detect Nepali or English; translate to the other language.
2. **Conversation** — Pass the phone. Speak with longer continuous listening; tap **Pass** / **पास** to finalize translation and flip to the other side. Chat bubbles; retry last turns (target for 1.5).

### Toggles
- **Formal** — ON = formal Nepali; OFF = informal.
- **देवनागरी** — ON = Devanagari; OFF = Roman Nepali (Auto always; Conversation on Nepali side).

## Shipped today (1.4.x / 1.5 track)
- Languages: **English ↔ Nepali only**
- Surfaces: **Expo iOS app only** (`mobile/`)
- MT: **offline phrasebook + lexicon** (honest UI labels: saved phrase / word guess)
- STT: **Apple Speech Recognition** (labeled “voice via Apple”; not fully offline)
- Gold Review: password-gated, paired formal/informal + Deva/Roman units
- Automated unit tests: `mobile/` Jest suite + CI
- No camera / OCR / hybrid PC server in the product path

## Version roadmap (fleet decision 2026-07-23)
See `mobile/docs/V2_FLEET_DECISION.md`.

| Version | Must ship |
|---------|-----------|
| **1.5.x** | Honesty + Jest + Conversation reliability (listen FSM, retry, Settings from Conversation) |
| **2.0.0** | On-device **neural MT** (IndicTrans2-class ONNX) + gold gates on shipped INT8 graphs |
| **2.1+** | whisper.rn fully offline STT; model download UX; formal/informal graphs |

**Do not brand 2.0** until neural MT is in the binary and passes gold.

## Goals
- [x] Single coherent product shell (Auto + Conversation + Formal/script)
- [x] Gold-standard bench + in-app review loop
- [x] Remove web/hybrid/glasses/PC-server code from the product path
- [x] Automated unit tests for pure MT / gold / STT helpers
- [ ] Path to on-device IndicTrans2 (ONNX) without PC runtime — **2.0 gate**
- [ ] Path to whisper.rn (or equivalent) offline STT — **2.1 gate**
- [ ] Docs (README / OFFLINE_IOS) match TestFlight honesty for current binary

## Constraints
- Must: run fully offline for **MT** after models are on device (phrasebook already offline)
- Must: ship iOS via Expo/EAS from Windows
- Must: EN↔NE only until a later major
- Must not: require a PC, tunnel, or cloud API for translation in the product path
- Must not: camera translate / smart glasses as current scope
- Must not: claim neural MT or fully offline STT in UI until those stacks ship

## Not Doing (through 2.0)
- PC hybrid Whisper/IndicTrans2 servers
- Web/Safari as a product surface
- Camera OCR
- Hindi or other Nepal languages as product languages
- Smart glasses / Brilliant Halo
- Swift-only rewrite (Expo shell; native modules OK for inference)

## Sensitive areas
- Apple Developer / EAS credentials
- Bundled model weights and licenses
- Private gold benchmark answers (do not publish if used as holdout)
