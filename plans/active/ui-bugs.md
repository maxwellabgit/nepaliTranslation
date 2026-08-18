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

- [x] Each finding is either **fixed** with a repro note, or **won't-fix** with a device-only blocker
- [x] Auto and Conversation: mode switch still hard-stops audio (`App.tsx` `switchMode` → `hardStopAudio`)
- [x] Formal / Informal and देवनागरी toggles still match INTENT
- [x] Loading, empty, error, and “MT not ready” states still exist
- [ ] Independent reviewer walked Home, Conversation, History, Settings, Meaning Review in source
- Shared: lexicon export + `tsc --noEmit` PASS, `verify:translate` PASS, no gold edits, ExecPlan updated, reviewer pending

## Milestones
- [x] Source walk of HomeScreen + ConversationScreen (loading/empty/error/offline/not-ready)
- [x] Mode switch hard-stops audio; overlays do not leak state
- [x] Toggle behavior vs INTENT
- [x] History / Settings / Meaning Review obvious breakage
- [x] Fix material issues (this lane only)
- [ ] Independent review

## Progress
Source walk + in-source fixes + proof commands complete (2026-08-18). Waiting on `/independent-reviewer`.

## Surprises & discoveries

Verified at source-walk (then fixed — see findings below). Do not treat these as current code:

- `hardStopAudio()` ran on Auto↔Conversation, History, Settings, and history restore (still true after the fix).
- Auto vs Conversation **was** a ternary unmount (thread wiped). Now both panes stay mounted.
- Retry last 5 turns was missing; 240 cap was silent; Formal chips showed on NE Auto; typed Pass dropped text; Pass looked enabled empty; History Clear had no confirm.

### Material findings (file:line + repro)

1. **Conversation retry missing** — Repro: Conversation → speak a turn → only Speak/Show. **Fixed:** `Retry` on the last 5 turns (`RETRY_TURN_LIMIT = 5`); re-runs MT on `heard` with current Formal/script; does not auto-speak.
2. **Silent 240-char cap** — Repro: type past 240 in Auto; chars stop with no explanation. **Fixed:** `n/240` in the composer (`HomeScreen` `charCount`); turns crimson at the cap. `maxLength={240}` unchanged.
3. **Tab switch destroys Conversation** — Repro: two turns → Auto → Conversation → thread gone. **Fixed:** both panes stay mounted; inactive uses `display: 'none'`; STT handlers no-op unless `active`. `hardStopAudio()` still on tab switch.
4. **Formal chips on NE→EN Auto** — Repro: input language Nepali; Formal/Informal still visible. **Fixed:** those chips render only when `sourceSide === 'en'`. Conversation still shows them (EN→NE turns).
5. **Typed Pass drops the reply** — Repro: no NE STT; type a reply; tap पास. **Fixed:** Pass commits `typedReply` when non-empty; empty Pass still hands back.
6. **Pass looks enabled with nothing to pass** — Repro: open Conversation, Pass is full crimson. **Fixed:** dimmed unless `canPassPhone` or typed-reply mode.
7. **History Clear is one tap, no confirm** — Repro: History → Clear wipes everything. **Fixed:** `Alert` confirm (Cancel / destructive Clear).

### Won't-fix / out of lane (with reason)

- Conversation Formal chips remain visible on the Nepali turn (EN→NE register for the other side).
- Typed-reply Pass stays enabled with empty text (silent hand-back).
- Independent review FAIL (2026-08-18) then fix: Pass/Retry/typed-send aborted on hide via `sessionGenRef`; Home debounce/preview gated on `active`.
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
- After independent-review FAIL 1: bump `sessionGenRef` when Conversation hides so Pass/Retry/typed-send cannot `startListeningFor` or speak after the tab switch. Gate Home `previewTranslate` / debounce / `applyResult` on `active` so a leftover Auto preview cannot bump `TranslationEngine` seq and cancel Conversation MT.
- After independent-review FAIL 2: `commitSentence` / `ingestTranscript` / `flushRemainder` no-op when hidden so a queued sentence chain cannot start a new `translate()` after `cancelAll`. `startListeningFor` re-checks `active` after the permissions await.
- Hide Formal/Informal on Auto when source language is Nepali. Leave them in Conversation (they apply to the English speaker’s EN→NE turns).
- Typed-mode Pass commits `typedReply` if non-empty, otherwise still allows a silent hand-back (existing exception for no NE STT).
- Do not change `theme.ts` colors (taste). Do not touch gold, training, ONNX, or decode-path formality.

## Commands that actually ran (paste)

```
$ cd /workspace/mobile && node ./scripts/export_meaning_lexicon.mjs && npx tsc --noEmit && npm run verify:translate
```

First `tsc` failed (pre-fix):

```
App.tsx(190,19): error TS2551: Property 'absoluteFillObject' does not exist on type 'typeof StyleSheet'. Did you mean 'absoluteFill'?
```

Switched to `StyleSheet.absoluteFill`. Re-run (cwd `/workspace/mobile`):

```
$ node ./scripts/export_meaning_lexicon.mjs && npx tsc --noEmit && npm run verify:translate
[lexicon] wrote src/mt/generated/meaningLexicon.json (86 KB) en=141 ne=195 romanSent=258 romanWords=304

> neptranslate@1.6.2 verify:translate
> node ./scripts/export_meaning_lexicon.mjs && node scripts/verify_translate_fix.mjs && node scripts/verify_romanize.mjs

[lexicon] wrote src/mt/generated/meaningLexicon.json (86 KB) en=141 ne=195 romanSent=258 romanWords=304
{"text":"Hey what's up can you hear me","method":"phrase","out":"हे, के छ? के तपाईंले मलाई सुन्न सक्नुहुन्छ","latin":false,"ok":true}
{"text":"can you hear me","method":"phrase","out":"के तपाईंले मलाई सुन्न सक्नुहुन्छ","latin":false,"ok":true}
{"text":"Hello","method":"phrase","out":"नमस्ते","latin":false,"ok":true}
{"text":"big dog","method":"lexicon","out":"ठूलो कुकुर","latin":false,"ok":true}
{"text":"xyzzy unknownword","method":"lexicon","out":"","latin":false,"ok":true}
{"text":"can you xyzzy me","method":"lexicon","out":"","latin":false,"ok":true}
OK
PHRASE_OK namaste → hello
PHRASE_OK tapai lai kasto cha? → how are you
PHRASE_OK dhanyabad → thank you
PHRASE_OK ma thik chu → i am fine
ROMAN_OK tapai → तपाईं
ROMAN_OK kasto → कस्तो
ROMAN_OK namaste → नमस्ते
ROMAN_OK pani → पानी
OK
```

`npx tsc --noEmit` exit 0 (no stdout). Diff is `mobile/App.tsx`, four screens, `plans/active/ui-bugs.md`. No gold, no training.

Re-run after abort-on-hide (same command, 2026-08-18, cwd `/workspace/mobile`): `tsc` exit 0; `verify:translate` OK / PHRASE_OK / ROMAN_OK (same output).

## Remaining work
- Independent review 1 FAIL: in-flight Pass re-armed the mic after hide; hidden Auto debounce could cancel Conversation MT. Fixed with `sessionGenRef` + `active` gates (see Decision log).
- Independent review 2 FAIL: queued `commitSentence` still called `translate()` after hide. Gated the chain.
- Independent review 3 pending.
- GitHub PR create is blocked for this principal (`must be a collaborator`); branch `cursor/ui-bugs-a8e4` is pushed.

## Blockers
- Cloud agent cannot TestFlight or run this app on an iPhone. Device-only (list, do not fake):
  - Keyboard covering the bottom phrase dock + tab bar on small iPhones (Auto uses `KeyboardAvoidingView` + composer near the top; still needs a device check).
  - Nepali STT/TTS availability (`SettingsScreen` “Speech on this device”).
  - Airplane-mode / on-device Whisper+ONNX warm-up timing.
  - Real mic `hardStopAudio` while Apple speech is live.
  - Contrast/hit-target of chips under True Tone / accessibility bold text.
