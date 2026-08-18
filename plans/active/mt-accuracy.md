# mt-accuracy: Better translations on the decode path

## Goal
Improve on-device EN↔NE output via phrase overlay, lexicon, romanize, and mashup refusal — without touching gold answers or training weights (lane 5 is not in play). Informal register must be तिमी-class (pronoun **and** verb), not तँ, and not a pronoun-only swap that leaves गर्नुहोस् honorifics.

## Context
- Paths: `mobile/src/mt/`, `mobile/scripts/verify_translate_fix.mjs`, `mobile/scripts/verify_romanize.mjs`, `mobile/scripts/export_meaning_lexicon.mjs`
- Gate: `cd mobile && npm run verify:translate`
- Also: `cd mobile && node ./scripts/export_meaning_lexicon.mjs && npx tsc --noEmit`
- Architecture: `training/ARCHITECTURE.md` — one IndicTrans2 family; informal = **तिमी** (not तँ); canonical Devanagari then optional Roman renderer; chat-Roman → Devanagari before NE→EN
- Gold is read-only. Never edit `benchmarks/gold/**/references.jsonl`. Do not commit `mobile/src/mt/generated/meaningLexicon.json`.

## Done when (lane 3)
- [x] `npm run verify:translate` passes
- [x] Gold references were **not** edited
- [x] Informal remains तिमी, not तँ
- [x] Roman input is still normalized before NE→EN where that path exists
- [ ] If gold eval ran: meet or beat frozen baseline, or revert
- [x] If gold eval could not run: blocker recorded; no quality claim
- [x] `cd mobile && node ./scripts/export_meaning_lexicon.mjs && npx tsc --noEmit`
- [x] Diff contains no unrelated files and no gold-reference edits
- [x] ExecPlan updated
- [ ] `/independent-reviewer` reported no material findings

## Decode path (inspected, not assumed)

Two entry points, same overlay primitives.

### Product entry: `TranslationEngine.translate`

1. If `neuralReady && sharedIndicTransOnnx.isReady()` → `translateNeural`; else `translateFallback`.
2. On throw → `translateFallback` (phrase/lexicon). Phrase authority must survive this.

### When neural is ready: `translateNeural`

Order is **phrase → ONNX → phrase/lexicon fallback**. Lexicon/compose is **not** inserted between an exact phrase hit and ONNX.

| Step | Function | Rule |
|------|----------|------|
| 1. Exact phrase | `translateOnDevice` (forcePreferred) | Return immediately if `method === 'phrase'`. Do not send in-domain lines to ONNX. |
| 2. Sentence chunk | `splitSentences` then recurse `translateNeural(..., bySentences: false)` | Only when `bySentences !== false` and more than one part. |
| 3a. NE→EN neural | `romanToDevanagari` if no Devanagari, then `sharedIndicTransOnnx.translate` | Chat-Roman is normalized to Devanagari **before** the model. Empty neural → `translateOnDevice` fallback. |
| 3b. EN→NE neural | `sharedIndicTransOnnx.translate` then `formatNepaliScript` | Empty neural → `translateOnDevice` fallback. |
| 4. Throw | `translate` catch → `translateFallback` | Same overlay as cold start. |

Do **not** break step 1 (phrase authority).

### Overlay / cold start: `translateOnDevice` → optional `translateBySentences`

Conceptual overlay (used when neural is off, empty, or throws):

```
text
  → detectDirection / forcePreferred
  → phraseLookup          (exact PHRASES, ROMAN_NE_PHRASES, meaningLexicon;
                           EN→NE name remainder only for "my name is X")
  → else EN→NE composeEnNe (greedy EN_PHRASE_PARTS then EN_WORDS;
                           unknown token ⇒ complete=false ⇒ empty; no Latin leftovers)
  → else NE→EN wordTranslate
  → applyInformal         (EN→NE + informal only)
  → formatNepaliScript    (EN→NE; romanize via romanize.ts)
```

| Function | File | Role |
|----------|------|------|
| `phraseLookup` | `onDeviceTranslate.ts` | Exact phrasebook + roman NE phrases + meaning lexicon. |
| `composeEnNe` | `onDeviceTranslate.ts` | Greedy EN→NE; refuses mashups (unknown English → empty). |
| `applyInformal` | `onDeviceTranslate.ts` | Register rewrite after overlay; must be तिमी-class verbs, not pronoun-only. |
| `formatNepaliScript` / `devanagariToRoman` | `romanize.ts` | Optional Roman renderer **after** canonical Devanagari. |
| `romanToDevanagari` | `romanize.ts` | Chat-Roman → Devanagari (lexicon words then syllable parser). |
| `looksLikeRomanNepali` | `romanize.ts` | Direction detect for typed Roman NE. |

## Milestones
- [x] Map decode path: phrase overlay → lexicon/compose → neural → `formatNepaliScript` / romanize (see above; neural-ready order is phrase → ONNX → overlay fallback)
- [x] Confirm mashup refusal still holds (`verify_translate_fix.mjs` cases, including prefix leftovers)
- [x] Fix informal verb/register mismatch (`applyInformal` now includes तिमी-class verbs; "sorry" informal is माफ गर)
- [x] Add/extend `verify_*.mjs` cases for register, mashup, roman; keep existing cases green
- [x] Re-run `npm run verify:translate` and `npx tsc --noEmit`; paste output
- [ ] Independent review until PASS

## Progress
Decode path mapped. Informal verbs + mashup hole + `lai`→लाई roman word shipped. JS gates green. Awaiting independent review.

## Surprises & discoveries
- `INFORMAL_REWRITES` previously only swapped तपाईं* → तिमी*. Phrase "sorry" / "excuse me" stayed माफ **गर्नुहोस्** under informal. Gold README requires तिमी **and** verb agreement; mixed तिमी + गर्नुहोस् is a register bug. Fixed with an explicit honorific→तिमी verb table.
- `phraseLookup` starts-with (`en.length >= 8`) treated any leftover Latin token as a name. "thank you xyzzy" / "can you hear me xyzzy" could return Nepali+Latin as `method === 'phrase'`, bypassing `composeEnNe` mashup refusal. Restricted to `my name is X`.
- `romanToDevanagari("lai")` syllable-parsed to लै, not लाई. `WORD_EXCEPTIONS.lai = लाई` so chat-Roman `tapai lai kasto cha?` becomes तपाईं लाई … before NE→EN neural. Overlay phrase path already hit `ROMAN_NE_PHRASES` exactly.
- Meaning lexicon `enToNe` stores **formal** NE only (`export_meaning_lexicon.mjs`); informal is decode-time `applyInformal`. Do not duplicate a second model family.
- IT2 merged weights / ONNX are not in this checkout (`training/artifacts/it2_*_merged`, `mobile/assets/models/`). Gold chrF cannot be run here.
- `npx tsc --noEmit` rejected `.sort()` on the INFORMAL_REWRITES literal (`string[][]` vs `[string, string][]`). Sort is now a separate mutating call.

## Decision log
- Do not reorder neural-ready decode to phrase → lexicon → ONNX. Exact `method === 'phrase'` stays ahead of ONNX.
- Informal verbs: explicit honorific → तिमी-class table (गर / सक्छौ / छौ / जाऊ / …), never तँ (गर्, छस्, …). Do not drop कृपया as a separate policy.
- Mashup: restrict Latin remainder to `my name is` prefixes only; refuse other phrase+Latin leftovers.
- House-style roman for the new informal sorry: `माफ गर` → `maaf gara` (matches `माफ गर्नुहोस्` → `maaf garnuhos`).
- No gold edits, no LoRA, no `meaningLexicon.json` commit, no UI restyle.

## Commands that actually ran (paste)

```
$ cd /workspace/mobile && npm run verify:translate

> neptranslate@1.6.2 verify:translate
> node ./scripts/export_meaning_lexicon.mjs && node scripts/verify_translate_fix.mjs && node scripts/verify_romanize.mjs

[lexicon] wrote src/mt/generated/meaningLexicon.json (86 KB) en=141 ne=195 romanSent=258 romanWords=305
{"text":"Hey what's up can you hear me","method":"phrase","out":"हे, के छ? के तपाईंले मलाई सुन्न सक्नुहुन्छ","latin":false,"ok":true}
{"text":"can you hear me","method":"phrase","out":"के तपाईंले मलाई सुन्न सक्नुहुन्छ","latin":false,"ok":true}
{"text":"Hello","method":"phrase","out":"नमस्ते","latin":false,"ok":true}
{"text":"big dog","method":"lexicon","out":"ठूलो कुकुर","latin":false,"ok":true}
{"text":"xyzzy unknownword","method":"lexicon","out":"","latin":false,"ok":true}
{"text":"can you xyzzy me","method":"lexicon","out":"","latin":false,"ok":true}
{"kind":"mashup","text":"thank you xyzzy","method":"lexicon","out":"","latin":false,"ok":true}
{"kind":"mashup","text":"can you hear me xyzzy","method":"lexicon","out":"","latin":false,"ok":true}
{"kind":"name","text":"my name is John","method":"phrase","out":"मेरो नाम John","ok":true}
{"kind":"register","label":"sorry-formal","ok":true,"out":"माफ गर्नुहोस्"}
{"kind":"register","label":"sorry-informal","ok":true,"out":"माफ गर"}
{"kind":"register","label":"can-you-help-me-formal","ok":true,"out":"के तपाईं मलाई मद्दत गर्न सक्नुहुन्छ"}
{"kind":"register","label":"can-you-help-me-informal","ok":true,"out":"के तिमी मलाई मद्दत गर्न सक्छौ"}
{"kind":"register","label":"how-are-you-informal","ok":true,"out":"तिमीलाई कस्तो छ"}
{"kind":"register","label":"go-informal","ok":true,"out":"जाऊ"}
{"kind":"register","label":"sorry-informal-roman","ok":true,"out":"maaf gara"}
OK
PHRASE_OK namaste → hello
PHRASE_OK tapai lai kasto cha? → how are you
PHRASE_OK dhanyabad → thank you
PHRASE_OK ma thik chu → i am fine
ROMAN_OK tapai → तपाईं
ROMAN_OK kasto → कस्तो
ROMAN_OK namaste → नमस्ते
ROMAN_OK pani → पानी
ROMAN_OK sentence tapai lai kasto cha? → तपाईं लाई कस्तो छ।
OK
```

```
$ cd /workspace/mobile && node ./scripts/export_meaning_lexicon.mjs && npx tsc --noEmit
[lexicon] wrote src/mt/generated/meaningLexicon.json (86 KB) en=141 ne=195 romanSent=258 romanWords=305
```

(`npx tsc --noEmit` exit 0, no diagnostics.)

IT2 gold eval not run — weights missing (see Blockers).

## Remaining work
- Independent review until PASS
- Honorific verbs that appear only in the meaning bank (not the phrase overlay) still depend on `applyInformal` covering their endings; table is phrase-overlay-complete, not a full morphological analyzer.

## Blockers
- **IT2 weights missing** in this environment: no `training/artifacts/it2_en_indic_merged`, `it2_indic_en_merged`, or bundled ONNX under `mobile/assets/models/`. `python benchmarks/eval_it2_gold.py` cannot run. **No chrF / gold-quality claim.** JS `verify:translate` is still required.
