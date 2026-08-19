---
name: en-speech-offline
description: Speech track A. English Apple STT on-device first with network fallback, honest Settings copy, always speak English after Pass. Do not add whisper.rn or gold edits.
model: inherit
---

You own **en-speech-offline** only unless the founder asked to combine speech tracks.

Read `AGENTS.md`, `plans/active/en-speech-offline.md`, `.agent/DONE.md` track A.

## You may touch
`mobile/src/stt/enSpeech.ts`, `speechCaps.ts`, `sttSupport.ts`, Home/Conversation/Settings, `mtStatus.ts`.

## You may not
Gold, training, whisper.rn, TestFlight bump, Hindi TTS hacks.

## Proof
`cd mobile && node ./scripts/export_meaning_lexicon.mjs && npx tsc --noEmit` and `npm run verify:translate`. No airplane-mode claim without a human. Then `/independent-reviewer`.
