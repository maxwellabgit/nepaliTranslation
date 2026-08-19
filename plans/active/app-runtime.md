# app-runtime: Faster, safer warm-up / cancel / pass-the-phone

## Goal
Make the live loop reliable: model warm-up, STT/TTS/MT cancel, conversation pass, neural-not-ready fallback. No visual restyles unless they unblock a runtime bug.

## Context
- Paths: `mobile/src/stt/`, `mobile/src/storage/`, `mobile/src/sync/`, `mobile/src/conversation/`, `mobile/src/mt/TranslationEngine.ts`, `mobile/src/mt/mtStatus.ts`, `mobile/App.tsx` only if cancel/mode-switch is broken
- Prefer `TranslationEngine` / STT changes over screen restyles (those belong to ui-bugs)
- UI lane already did conversation retry / hide races; this lane owns overlay vs `active` and hard-stop completeness

## Done when
Lane 4 checklist in `.agent/DONE.md`.

## Milestones
- [x] Trace warm-up + reverse-model settle from `App.tsx` (failure banner still clears; phrasebook remains)
- [x] Trace hardStop / cancelAll — `hardStopSpeech()` now covers Apple STT + TTS + Whisper no-op
- [x] History / Settings overlays set `active={mode && overlay === null}` so `end` cannot re-arm under an overlay
- [x] Conversation `!active` also `hardStopSpeech()` (not just flags)
- [x] Pass rules unchanged (`passLogic.ts`); typed Nepali fallback still allows Pass
- [x] Independent review (PASS; wired Conversation trust line to `mtStatusLine`)

## Progress
Highest-impact runtime bug fixed: screens stayed `active` while History/Settings covered them, so Conversation `end` could re-arm the mic. Warm-up path left as-is (already soft-fails).

## Surprises & discoveries
- UI lane kept both panes mounted (`display:none`). That made overlay-vs-active a real bug, not a theoretical one.
- `getSttSupport` fail-open on Nepali skipped typed fallback; fixed fail-closed as part of speech tracks on this branch.

## Decision log
- Overlay deactivates both panes rather than only calling `hardStopAudio` (events can still fire after abort).

## Commands that actually ran (paste)

```
cd /workspace/mobile && node ./scripts/export_meaning_lexicon.mjs && npx tsc --noEmit
# exit 0

cd /workspace/mobile && npm run verify:translate
# OK
```

## Remaining work
Device QA: open History while Conversation is listening; confirm mic stays dead until overlay closes.

## Blockers
No iPhone in this cloud VM.
