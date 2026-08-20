# Done is expensive

“I edited the files” is never Done. Use the checklist for **your lane only**.

Shared (every lane that touches `mobile/`):

- [ ] `cd mobile && node ./scripts/export_meaning_lexicon.mjs && npx tsc --noEmit`
- [ ] `cd mobile && npm run verify:translate`
- [ ] Diff contains no unrelated files and no gold-reference edits
- [ ] ExecPlan updated
- [ ] `/independent-reviewer` reported no material findings

## Lane 1 — eval-integrity

- [ ] Gold schema still valid (`benchmarks/gold/schema.json` + each class `manifest.json`)
- [ ] No training script or docs now tell anyone to train on gold
- [ ] Register mix rejected: informal rows are तिमी-class, formal rows are तपाईं-class (spot-check + any probe you ran)
- [ ] Holdout freeze story still true (see `benchmarks/gold/README.md`)
- [ ] Commands pasted in the ExecPlan

## Lane 2 — ui-bugs

- [ ] Each finding is either **fixed** with a repro note, or **won't-fix** with a device-only blocker
- [ ] Auto and Conversation: mode switch still hard-stops audio (`App.tsx`)
- [ ] Formal / Informal and देवनागरी toggles still match INTENT
- [ ] Loading, empty, error, and “MT not ready” states still exist
- [ ] Independent reviewer walked Home, Conversation, History, Settings, Meaning Review in source

Honest limit: a cloud agent cannot TestFlight. Do not claim airplane-mode device proof unless a human did it.

## Lane 3 — mt-accuracy

- [ ] `npm run verify:translate` passes
- [ ] Gold references were **not** edited
- [ ] Informal remains तिमी, not तँ
- [ ] Roman input is still normalized before NE→EN where that path exists
- [ ] If gold eval ran: meet or beat frozen baseline, or revert
- [ ] If gold eval could not run: blocker recorded; no quality claim

## Lane 4 — app-runtime

- [ ] Warm-up still does not brick the UI when neural is slow/failing
- [ ] Cancel / hard-stop still stops STT + TTS + in-flight MT
- [ ] Conversation pass rules still match `src/conversation/passLogic.ts`
- [ ] Phrasebook / fallback path still works when neural is not ready
- [ ] `npx tsc --noEmit` + `npm run verify:translate`

## Lane 5 — model-ship

- [ ] Still one IT2 family; LoRA not `merge_and_unload`
- [ ] INT8-first; gold register/names survive any quant discussion
- [ ] Export path still ends at `mobile/assets/models/` (see `docs/OFFLINE_IOS.md`)
- [ ] Gold eval vs frozen baseline if weights exist; otherwise explicit GPU/artifact blocker
- [ ] No new PC/cloud inference in the product path

## Lane 6 — companion-tools

- [ ] INTENT lists Rates + Learn as Settings overlays; Auto + Conversation remain the only translation modes
- [ ] Rates converter works from bundled seed with no network
- [ ] Optional NRB refresh updates cache; failure leaves seed/cache visible with an as-of date
- [ ] INR / JPY `unit` is applied (no 100× INR bug)
- [ ] English alphabet: A–Z, example word, Play via `expo-speech`
- [ ] Nepali alphabet: listed vowels + consonants; Play under every letter
- [ ] Nepali Play uses bundled audio, not `ne-NP` TTS as the primary path
- [ ] Overlay open/close stops STT/TTS/letter audio (`hardStopAudio`)
- [ ] Informal example words use तिमी, not तँ
- [ ] Independent reviewer walked Settings → Rates and Settings → Learn in source

Honest limit: missing native letter recordings or no TestFlight are blockers, not Done.
