# app-runtime: Faster, safer warm-up / cancel / pass-the-phone

## Goal
Make the live loop reliable: model warm-up, STT/TTS/MT cancel, conversation pass, neural-not-ready fallback. No visual restyles unless they unblock a runtime bug.

## Context
- Paths: `mobile/src/stt/`, `mobile/src/storage/`, `mobile/src/sync/`, `mobile/src/conversation/`, `mobile/src/mt/TranslationEngine.ts`, `mobile/src/mt/mtStatus.ts`, `mobile/App.tsx` only if cancel/mode-switch is broken
- Prefer `TranslationEngine` / STT changes over screen restyles (those belong to ui-bugs)

## Done when
Lane 4 checklist in `.agent/DONE.md`.

## Milestones
- [ ] Trace warm-up + reverse-model settle from `App.tsx`
- [ ] Trace hardStop / cancelAll
- [ ] Trace Conversation pass (`passLogic.ts`) and Nepali typed fallback
- [ ] Fix the highest-impact runtime bug
- [ ] Independent review

## Progress
Not started.

## Surprises & discoveries

## Decision log

## Commands that actually ran (paste)

## Remaining work
All milestones.

## Blockers
