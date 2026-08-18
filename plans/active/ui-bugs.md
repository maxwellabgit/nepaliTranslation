# ui-bugs: Find and fix user-visible Expo bugs

## Goal
Walk Auto, Conversation, History, Settings, and Meaning Review in source; fix material UI bugs; list device-only issues as blockers.

## Context
- Paths: `mobile/App.tsx`, `mobile/src/screens/`, `mobile/src/theme.ts`
- INTENT modes: Auto (type or speak) + Conversation (Pass / पास)
- Toggles: Formal, देवनागरी
- Cheap gate: `cd mobile && npm run verify:translate` and `npx tsc --noEmit`
- Honest limit: no TestFlight in a typical cloud run

## Done when
Lane 2 checklist in `.agent/DONE.md`.

## Milestones
- [ ] Source walk of HomeScreen + ConversationScreen (loading/empty/error/offline/not-ready)
- [ ] Mode switch hard-stops audio; overlays do not leak state
- [ ] Toggle behavior vs INTENT
- [ ] History / Settings / Meaning Review obvious breakage
- [ ] Fix material issues (this lane only)
- [ ] Independent review

## Progress
Not started.

## Surprises & discoveries

## Decision log

## Commands that actually ran (paste)

## Remaining work
All milestones.

## Blockers
