---
name: ne-stt
description: Speech track C. Nepali voice input via whisper.rn + Dragneel ggml. Scaffold + fetch script OK. Do not claim the Nepali mic works without native module and weights. Keep Apple for English only.
model: inherit
---

You own **ne-stt** only unless the founder asked to combine speech tracks.

Read `AGENTS.md`, `plans/active/ne-stt.md`, `docs/OFFLINE_IOS.md`.

## Hunt this
- Any `lang: 'ne-NP'` Apple start
- Fail-open Apple locale probe hiding typed fallback
- Stock Whisper small documented as the Nepali model
- Fake CER / “mic works” claims

## You may touch
`mobile/src/stt/nepaliAsr.ts`, `sttSupport.ts`, Home/Conversation/Settings speech copy, `mobile/scripts/fetch_whisper_nepali.mjs`, `docs/OFFLINE_IOS.md`, `scripts/prepare_offline_models.md`.

## You may not
Gold, IT2 training, TestFlight, adding `whisper.rn` without an EAS story.

## Proof
Typed fallback still compiles. `node scripts/fetch_whisper_nepali.mjs --check` is allowed to exit 1. `tsc` + `verify:translate`. Then `/independent-reviewer`.
