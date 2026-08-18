# ui-bugs: Find and fix user-visible Expo bugs

## Goal
Walk Auto, Conversation, History, Settings, and Meaning Review in source; fix material UI bugs; list device-only issues as blockers.

## Context
- Paths: `mobile/App.tsx`, `mobile/src/screens/`, `mobile/src/theme.ts`; tiny `passLogic.ts` only if pass enablement is wrong
- INTENT modes: Auto (type or speak) + Conversation (Pass / पास, chat bubbles, retry last 5 turns)
- Toggles: Formal (EN→NE only), देवनागरी
- Cheap gate: `cd mobile && node ./scripts/export_meaning_lexicon.mjs && npx tsc --noEmit` and `npm run verify:translate`
- Honest limit: no TestFlight in a typical cloud run
- Expo SDK 57 docs only: https://docs.expo.dev/versions/v57.0.0/

## Done when
Lane 2 checklist in `.agent/DONE.md`:

- [ ] Each finding is either **fixed** with a repro note, or **won't-fix** with a device-only blocker
- [ ] Auto and Conversation: mode switch still hard-stops audio (`App.tsx`)
- [ ] Formal / Informal and देवनागरी toggles still match INTENT
- [ ] Loading, empty, error, and “MT not ready” states still exist
- [ ] Independent reviewer walked Home, Conversation, History, Settings, Meaning Review in source
- Shared: lexicon export + `tsc --noEmit`, `verify:translate`, no gold edits, ExecPlan updated, reviewer PASS

## Milestones
- [x] Source walk of HomeScreen + ConversationScreen (loading/empty/error/offline/not-ready)
- [x] Mode switch hard-stops audio; overlays do not leak state
- [x] Toggle behavior vs INTENT
- [x] History / Settings / Meaning Review obvious breakage
- [ ] Fix material issues (this lane only)
- [ ] Independent review

## Progress
Source walk complete (2026-08-18). Highest-impact in-source fixes in progress. Proof and independent review not started.

## Surprises & discoveries

Verified (not assumed):

- `hardStopAudio()` runs on Auto↔Conversation (`App.tsx:75-78`), History open (`93-95`), Settings open (`97-99`), and history restore (`140-145`).
- Auto vs Conversation is a ternary (`App.tsx:85-102`): Conversation **unmounts** on tab switch (thread wiped). Overlays keep Home underneath (`134` comment).
- INTENT Conversation retry last 5 turns is **missing** in `ConversationScreen.tsx` (no Retry control). Product bug vs INTENT.
- Home `MAX_INPUT_CHARS = 240` with `maxLength` (`HomeScreen.tsx:58`, `595`) but **no visible counter**. User hits a silent wall.
- Prefs persist via `src/storage/prefs.ts` (defaults both ON). Phrase-path formality applies only on EN→NE (`onDeviceTranslate.ts:697`). Home still shows Formal/Informal when source is Nepali (`HomeScreen.tsx:641-659`).
- Home shows `mtWarmStatus`, then “Model unavailable — using saved phrases” (`678-684`). Conversation only gets `neuralReady` trust line (`704-708`) — no warm banner.
- `canPassPhone` requires interim or a completed turn from this side (`passLogic.ts:6-13`). Typed Nepali fallback exists (`ConversationScreen.tsx:71-72`, `417-434`). **Pass in typed mode ignores `typedReply`** (`374-384`): user types a reply, taps पास, text is discarded.
- Meaning Review lock is `1234` (`MeaningReviewScreen.tsx:31`). INTENT does not say to remove it.
- Chip hit targets are ~24pt (`paddingVertical: 6`, `fontSize: 12`) on Home and Conversation — below 44pt.

### Material findings (file:line + repro)

1. **Conversation retry missing** — `ConversationScreen.tsx` (whole screen; hero actions at `601-614`). Repro: start Conversation, speak a turn, look at the bubble. INTENT says retry last 5 turns. There is Speak/Show only. User cannot re-translate a bad turn after toggling Formal.
2. **Silent 240-char cap** — `HomeScreen.tsx:58,595`. Repro: type past ~240 chars in Auto. Keyboard still accepts presses but characters stop appearing. No “240” anywhere on screen.
3. **Tab switch destroys Conversation** — `App.tsx:85-87`. Repro: Conversation, speak two turns, tap Auto, tap Conversation. Thread is gone. Accidental tab tap during a live handoff wipes the dialogue. Home composer is also remounted (`88-101`).
4. **Formal chips on NE→EN Auto** — `HomeScreen.tsx:641-659`. Repro: set input language to Nepali. Formal/Informal still show. INTENT: Formal only changes EN→NE register. Tapping Informal does not change English output (phrase path) but the UI claims it will.
5. **Typed Pass drops the reply** — `ConversationScreen.tsx:374-384, 641-706`. Repro: device without Nepali STT; Conversation; Pass to Nepali side; type a reply; tap पास instead of पठाउनुहोस्. Phone flips to English; typed text is not translated or shown.
6. **Pass looks enabled with nothing to pass** — `ConversationScreen.tsx:687-702`. Repro: open Conversation, tap Pass immediately. Button is full crimson. Then it greys and shows “Say something before Pass”. Enablement rule is correct in `passLogic.ts`; the control lies.
7. **History Clear is one tap, no confirm** — `HistoryScreen.tsx:131-140`. Repro: History → Clear. Entire list is gone. Swipe-delete of one row is fine; bulk clear is not.

### Won't-fix / out of lane (with reason)

- Conversation has no History/Settings chrome. After finding 3 is fixed, user can switch to Auto without losing the thread and open overlays there. Not a new product mode.
- Conversation has no `mtWarmStatus` banner — matches known product fact; trust line covers not-ready. Not a dead screen.
- Meaning Review password 1234 — architecture lock; INTENT does not ask to remove it.
- Overlay covering the tab bar — full-screen History/Settings; close returns to Auto. Intended.
- Neural STT/TTS on a real iPhone, airplane-mode, keyboard covering the docked phrase list on a small device — **device-only**. See Blockers.

### Hunt list checked, not material in source

- Mode switch stops STT/TTS: yes (`hardStopAudio`).
- History seed fills Auto: `seed` + `seedKey` remount (`App.tsx:86-90`, `140-145`; `HomeScreen.tsx:81-85`).
- Settings → Advanced → Meaning Review is not a dead end (`SettingsScreen.tsx:145-157`).
- Empty/loading/error: Home phrases dock when empty (`497,750-776`); Conversation empty card (`551-561`); busy spinner (`627-634`); STT permission / NE STT alerts (`355-360`, `386-389`); Settings “Checking…” (`132`); Meaning Review lock + queue-complete card.
- `canPassPhone` logic itself is correct; UI lying and typed Pass are the bugs.
- Devanagari result type is already 30–42pt. Chip label at 12pt is the small bit — bump chip hit target/type, do not restyle the palette.

## Decision log
- Conversation retry = re-run MT on `heard` for the last 5 turns only, with current Formal/script. Do not auto-speak (Speak remains). Do not add a sixth mode.
- Keep both Auto and Conversation mounted; hide the inactive pane (`display: 'none'`). Gate STT event handlers on `active` so the hidden screen cannot ingest the other’s speech. Reload prefs when a pane becomes active so Formal/देवनागरी stay in sync.
- Hide Formal/Informal on Auto when source language is Nepali. Leave them in Conversation (they apply to the English speaker’s EN→NE turns).
- Typed-mode Pass commits `typedReply` if non-empty, otherwise still allows a silent hand-back (existing exception for no NE STT).
- Do not change `theme.ts` colors (taste). Do not touch gold, training, ONNX, or decode-path formality.

## Commands that actually ran (paste)

## Remaining work
- Implement findings 1–7
- Proof commands
- Independent review until PASS

## Blockers
- Cloud agent cannot TestFlight or run this app on an iPhone. Device-only (list, do not fake):
  - Keyboard covering the bottom phrase dock + tab bar on small iPhones (Auto uses `KeyboardAvoidingView` + composer near the top; still needs a device check).
  - Nepali STT/TTS availability (`SettingsScreen` “Speech on this device”).
  - Airplane-mode / on-device Whisper+ONNX warm-up timing.
  - Real mic `hardStopAudio` while Apple speech is live.
  - Contrast/hit-target of chips under True Tone / accessibility bold text.
