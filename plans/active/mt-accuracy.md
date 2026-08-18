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
- [ ] `npm run verify:translate` passes
- [ ] Gold references were **not** edited
- [ ] Informal remains तिमी, not तँ
- [ ] Roman input is still normalized before NE→EN where that path exists
- [ ] If gold eval ran: meet or beat frozen baseline, or revert
- [ ] If gold eval could not run: blocker recorded; no quality claim
- [ ] `cd mobile && node ./scripts/export_meaning_lexicon.mjs && npx tsc --noEmit`
- [ ] Diff contains no unrelated files and no gold-reference edits
- [ ] ExecPlan updated
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
- [ ] Confirm mashup refusal still holds (`verify_translate_fix.mjs` cases, including prefix leftovers)
- [ ] Fix informal verb/register mismatch (`applyInformal` pronouns-only today; "sorry" stays माफ गर्नुहोस्)
- [ ] Add/extend `verify_*.mjs` cases for register, mashup, roman; keep existing cases green
- [ ] Re-run `npm run verify:translate` and `npx tsc --noEmit`; paste output
- [ ] Independent review until PASS

## Progress
Decode path mapped from `TranslationEngine.ts` + `onDeviceTranslate.ts` + `romanize.ts`. Next: smallest script-catchable accuracy fixes (informal verbs + phrase-prefix mashup hole), then verify.

## Surprises & discoveries
- `INFORMAL_REWRITES` only swaps तपाईं* → तिमी*. Phrase "sorry" / "excuse me" stay माफ **गर्नुहोस्** (honorific verb) under informal. Gold README requires तिमी **and** verb agreement; mixed तिमी + गर्नुहोस् is a register bug.
- `phraseLookup` starts-with (`en.length >= 8`) treats any leftover Latin token as a name. "thank you xyzzy" / "can you hear me xyzzy" can return Nepali+Latin as `method === 'phrase'`, bypassing `composeEnNe` mashup refusal. Comment says this is only for "my name is X".
- Meaning lexicon `enToNe` stores **formal** NE only (`export_meaning_lexicon.mjs`); informal is decode-time `applyInformal`. Do not duplicate a second model family.
- IT2 merged weights / ONNX are not in this checkout (`training/artifacts/it2_*_merged`, `mobile/assets/models/`). Gold chrF cannot be run here.

## Decision log
- Do not reorder neural-ready decode to phrase → lexicon → ONNX. Exact `method === 'phrase'` stays ahead of ONNX.
- Informal verbs: explicit honorific → तिमी-class table (गर / सक्छौ / छौ / जाऊ / …), never तँ (गर्, छस्, …). Do not drop कृपया as a separate policy.
- Mashup: restrict Latin remainder to `my name is` prefixes only; refuse other phrase+Latin leftovers.
- No gold edits, no LoRA, no `meaningLexicon.json` commit, no UI restyle.

## Commands that actually ran (paste)

(pending implement + verify)

## Remaining work
- Informal verb rewrites + verify cases
- Close phrase-prefix mashup hole + verify cases
- Proof commands + independent review

## Blockers
- **IT2 weights missing** in this environment: no `training/artifacts/it2_en_indic_merged`, `it2_indic_en_merged`, or bundled ONNX under `mobile/assets/models/`. `python benchmarks/eval_it2_gold.py` cannot run. **No chrF / gold-quality claim.** JS `verify:translate` is still required.
