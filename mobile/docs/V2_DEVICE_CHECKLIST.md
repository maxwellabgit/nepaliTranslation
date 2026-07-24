# Device / TestFlight checklist (v1.5 → v2)

Unit tests cover pure TS helpers. These items need a real iPhone / TestFlight build.

## Trust & honesty

- [ ] Auto header does **not** claim full offline voice while using Apple STT
- [ ] Footer: `phrasebook offline · voice via Apple` (or neural badge when models ship)
- [ ] Lexicon / word-guess results are labeled differently from saved-phrase hits
- [ ] Settings → About matches what the binary actually runs

## Auto mode

- [ ] Type EN → NE phrase hit (Hello → नमस्ते)
- [ ] Formal / Informal chips change register on phrase hits
- [ ] Devanagari / Roman toggle changes Nepali display
- [ ] Mic EN locale; speak English; translate appears
- [ ] Mic with Nepali Devanagari (Nepali keyboard); direction stays sensible
- [ ] Airplane mode: typing still translates; note speech may fail without Apple network ASR

## Conversation

- [ ] Consent sheet once; Speak → Pass → partner can read
- [ ] Empty Pass blocked + haptic
- [ ] Pass while TTS speaking does not immediately re-listen into echo (after mutex fix)
- [ ] Formal refresh remaps prior Nepali shows
- [ ] Can open Settings without leaving Conversation (after 1.5 chrome fix)

## Gold Review (internal)

- [ ] Settings → Advanced → Gold Review → password
- [ ] Paired formal/informal: Correct both writes two ids
- [ ] Paired Deva/Roman: Correct both
- [ ] Export Share/clipboard works
- [ ] Tap outside editors dismisses keyboard

## Neural 2.0 gate (only when ONNX ships)

- [ ] Airplane mode neural translate works
- [ ] UI badge says on-device model (not phrasebook)
- [ ] Fallback to phrasebook labeled when assets missing
- [ ] Frozen gold eval of **shipped** INT8 graphs passes written gates
