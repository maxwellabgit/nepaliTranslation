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
- [ ] History / Settings overlays deactivate Auto and Conversation (`active={mode && overlay === null}`)
- [ ] Conversation pass rules still match `src/conversation/passLogic.ts`
- [ ] Phrasebook / fallback path still works when neural is not ready
- [ ] `npx tsc --noEmit` + `npm run verify:translate`

## Lane 5 — model-ship

- [ ] Still one IT2 family; LoRA not `merge_and_unload`
- [ ] INT8-first; gold register/names survive any quant discussion
- [ ] Export path still ends at `mobile/assets/models/` (see `docs/OFFLINE_IOS.md`)
- [ ] Gold eval vs frozen baseline if weights exist; otherwise explicit GPU/artifact blocker
- [ ] No new PC/cloud inference in the product path

## Track A — en-speech-offline

- [ ] English `start` uses `requiresOnDeviceRecognition: true` first, network fallback on failure
- [ ] Settings About + Speech caps do not say English always needs a network
- [ ] Conversation still speaks English translations after Pass (skip only missing Nepali TTS)
- [ ] No TestFlight / airplane-mode claim unless a human did it
- [ ] `npx tsc --noEmit` + `npm run verify:translate`

## Track C — ne-stt

- [ ] Home / Conversation never start Apple `lang: 'ne-NP'`
- [ ] Typed Nepali fallback still shows when Whisper is not ready
- [ ] Fetch script exists; `--check` is honest on a machine without the ggml
- [ ] whisper.rn not added to `package.json` unless an EAS/device proof exists
- [ ] No claim that Nepali mic works on this VM

## Track D — ne-tts

- [ ] Speak helper never uses Hindi (`hi-IN`) as Nepali
- [ ] Nepali TTS skipped when `hasNepaliVoice()` is false (Home Speak disabled; Conversation Pass still speaks English)
- [ ] No cloud TTS in the product path
- [ ] Piper/MMS (or other bundled) engine recorded as a blocker if not shipped

