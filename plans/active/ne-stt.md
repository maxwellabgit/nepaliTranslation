# ne-stt: Nepali voice input via Whisper (not Apple)

## Goal
Nepali mic uses whisper.rn + Dragneel ggml when both are present. Until then, typed fallback. Never pretend Apple `ne-NP` works.

## Context
- Adapter: `mobile/src/stt/nepaliAsr.ts`
- Fetch (no default 190MB download): `mobile/scripts/fetch_whisper_nepali.mjs`
- Probe file: `mobile/assets/models/whisper/ggml-ne-small-q5_1.bin` (gitignored)
- Keep Apple English path in `enSpeech.ts`

## Done when
Track C checklist in `.agent/DONE.md`. Live device ASR is **not** required to close the scaffold; claiming the mic works is.

## Milestones
- [x] `isNepaliAsrReady()` fail-closed (native module not linked + no ggml)
- [x] Home / Conversation never `start({ lang: 'ne-NP' })`
- [x] Typed fallback when Whisper is not ready
- [x] Fetch script + `--check`; docs no longer tell people to ship stock Whisper small as Nepali STT
- [ ] Link whisper.rn + bundle ggml in an EAS build (founder / GPU machine)
- [x] Independent review of this scaffold (PASS; no material findings)

## Progress
Scaffold shipped. Live Nepali ASR is a blocker.

## Surprises & discoveries
- `getSttSupport()` used to fail **open** on Nepali (`ne: true` when locales missing). That hid typed fallback. English still fails open; Nepali now fails closed.
- Metro would fail the bundle on `import('whisper.rn')` while the package is absent, so the adapter does not dynamic-import it.

## Decision log
- Do **not** add `whisper.rn` to `package.json` from this VM (native module, EAS rebuild, untestable here).
- Do **not** download the ggml in CI.

## Commands that actually ran (paste)

```
cd /workspace/mobile && node ./scripts/export_meaning_lexicon.mjs && npx tsc --noEmit
# exit 0

cd /workspace/mobile && npm run verify:translate
# OK

cd /workspace/mobile && node ./scripts/fetch_whisper_nepali.mjs --check
# [whisper] missing ggml-ne-small-q5_1.bin  (exit 1, expected)
```

## Remaining work
EAS production profile: add whisper.rn, pack `ggml-ne-small-q5_1.bin`, implement `startNepaliAsr` with the native module, then device CER check.

## Blockers
- whisper.rn not linked
- `ggml-ne-small-q5_1.bin` not on this VM (~190 MB)
- No iPhone / EAS in this run
