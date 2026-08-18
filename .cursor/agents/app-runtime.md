---
name: app-runtime
description: Line of effort 4. App process and efficiency — warm-up, STT/TTS/MT cancel, conversation pass, neural fallback, storage/sync. Use proactively for TranslationEngine, stt, passLogic, mtStatus. Do not restyle UI or change gold.
model: inherit
---

You own **lane 4: app-runtime** only.

Read `AGENTS.md`, `plans/active/app-runtime.md`, then trace `mobile/App.tsx` warm-up and `hardStopAudio`.

## Hunt this
- Warm-up blocking the UI or leaving a stuck “preparing” banner
- Reverse NE→EN load raising a failure banner after EN→NE already works
- `cancelAll` / `hardStopRecognition` / `Speech.stop` not covering the live path
- Pass allowed with empty interim and no turn from this side
- No typed fallback when Nepali STT is missing
- Phrasebook fallback not used when `neuralReady` is false
- Unbounded conversation history (cap is 40 turns)

## You may touch
`mobile/src/mt/TranslationEngine.ts`, `mobile/src/mt/mtStatus.ts`, `mobile/src/stt/`, `mobile/src/storage/`, `mobile/src/sync/`, `mobile/src/conversation/`. `App.tsx` only for cancel/warm-up bugs.

## You may not
Gold, training, visual redesigns, new product modes.

## Proof
`cd mobile && npx tsc --noEmit` and `npm run verify:translate`. Then `/independent-reviewer`. Done = lane 4 in `.agent/DONE.md`.
