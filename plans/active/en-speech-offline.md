# en-speech-offline: English mic on-device first

## Goal
English voice input prefers Apple on-device recognition and falls back to network once per session. Settings copy matches that. Conversation still speaks English translations after Pass.

## Context
- Paths: `mobile/src/stt/enSpeech.ts`, `speechCaps.ts`, `HomeScreen.tsx`, `ConversationScreen.tsx`, `SettingsScreen.tsx`, `mtStatus.ts`
- Nepali STT is `/ne-stt`. Do not add whisper.rn here.
- Device airplane-mode proof is human-gated.

## Done when
Track A checklist in `.agent/DONE.md`.

## Milestones
- [x] Centralize English `start` (`startEnglishAsr`) with `requiresOnDeviceRecognition: true` then network fallback
- [x] Flip to network on English ASR error (`noteEnglishAsrError`)
- [x] Settings About + caps no longer say speech always needs a network
- [x] Conversation Pass still speaks English (`speakUtterance` lang `en`); skips only missing Nepali TTS
- [x] Independent review (PASS; nits: Conversation trust line now uses `mtStatusLine`; ASCII diagram updated)

## Progress
Implemented on `cursor/speech-runtime-tracks-9f0b` with tracks C/D and lane 4 at founder request.

## Surprises & discoveries
- `ExpoSpeechRecognitionModule.start` is synchronous (`void`). Fallback on throw covers sync failures; error events flip the next start to network.
- `supportsOnDeviceRecognition()` exists on the module; probed once per session.
- Previous Settings line “English voice input · available” ignored the Apple probe entirely.

## Decision log
- Prefer on-device for English only. Never start Apple `ne-NP`.
- Do not auto-restart Home listening on error (overlay/abort race). Conversation continuous re-arm uses the updated mode.

## Commands that actually ran (paste)

```
cd /workspace/mobile && node ./scripts/export_meaning_lexicon.mjs && npx tsc --noEmit
# exit 0

cd /workspace/mobile && npm run verify:translate
# OK (phrase/lexicon/register/romanize)

cd /workspace/mobile && node ./scripts/fetch_whisper_nepali.mjs --check
# [whisper] missing ggml-ne-small-q5_1.bin
# exit 1 (expected; not a product failure)
```

## Remaining work
Airplane-mode English STT on a physical iPhone.

## Blockers
No iPhone in this cloud VM. Cannot prove on-device Apple English STT vs network.
