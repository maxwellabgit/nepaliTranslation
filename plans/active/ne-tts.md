# ne-tts: On-device Nepali spoken aloud (not Hindi, not cloud)

## Goal
When a Nepali OS voice exists, speak `ne-NP`. When it does not, skip — never Hindi-as-Nepali, never a cloud TTS API. A bundled engine (Piper / MMS / similar) is the real product path and is not in this install.

## Context
- Helper: `mobile/src/stt/speak.ts`
- Probe: `hasNepaliVoice()` in `sttSupport.ts`
- Home Speak button already disabled when `!neVoiceOk`
- Conversation Pass already skipped Nepali TTS when `!neVoiceOk` and still speaks English

## Done when
Track D checklist in `.agent/DONE.md`. Bundled engine is a blocker, not a fake Done.

## Milestones
- [x] `speakUtterance` centralizes language: `en-US` or `ne-NP` only
- [x] Skip Nepali when `neVoiceOk === false`
- [x] Settings copy: no Hindi substitute; no bundled Nepali voice yet
- [ ] Bundle Piper/MMS (or other on-device) Nepali voice in the IPA
- [x] Independent review of skip-path honesty (PASS; no material findings)

## Progress
Skip-path + helper shipped. Bundled TTS engine is a blocker.

## Surprises & discoveries
- iOS typically has no `ne-*` Siri voice, so Conversation already skipped auto-speak of EN→NE. English after Pass was already spoken; helper preserves that.

## Decision log
- No `hi-IN` fallback. INTENT forbids Hindi as a product language.
- No cloud TTS in the product path.

## Commands that actually ran (paste)

```
cd /workspace/mobile && node ./scripts/export_meaning_lexicon.mjs && npx tsc --noEmit
# exit 0

cd /workspace/mobile && npm run verify:translate
# OK
```

## Remaining work
Choose and bundle an on-device Nepali TTS engine; EAS native module; device QA.

## Blockers
No Piper/MMS (or other) Nepali voice in the repo or IPA. This VM cannot ship a 10–50 MB voice binary and prove playback.
