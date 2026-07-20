# Gold standard eval (EN ↔ NE)

Private holdout for product quality decisions. **~100 curated samples per class**, high quality / low quantity.

## Why these classes

| Class | Why |
|-------|-----|
| `en_ne_formal` | English speaker wants respectful Nepali (`तपाईं` + verb agreement) |
| `en_ne_informal` | Peer/friend Nepali (`तिमी` + verb agreement) |
| `ne_en_deva` | Devanagari Nepali → English (core direction) |
| `ne_en_roman` | Chat-style Roman Nepali → English (common diaspora typing) |

**v1 languages:** English ↔ Nepali only. NPHC 2021: Nepali is the largest mother tongue (~44.9%) and the national lingua franca; Maithili / Bhojpuri / Tharu are later expansions.

## Layout

```
benchmarks/gold/
  schema.json
  en_ne_formal/{manifest.json,sources.jsonl,references.jsonl}
  en_ne_informal/...
  ne_en_deva/...
  ne_en_roman/...   # sources include roman + optional deva normalization
```

Each class has **100 reviewed samples** (`status: reviewed`). Regenerate with `python benchmarks/fill_gold.py`.

## Curation recipe

1. Prefer **hand-authored / work-for-hire** references for commercial clarity.
2. Seed from **IN22-Conv** (`ai4bharat/IN22-Conv`, CC-BY-4.0) for conversational EN↔NE — then rewrite register pairs with native speakers.
3. **Do not** treat FLORES alone as conversational gold; use only as optional prompt seed if re-translated.
4. Formal/informal: same English intent, different Nepali pronouns **and** verbs. Reject mixed register (तिमी + गर्नुहोस्).
5. Roman: native speakers produce natural Roman from Devanagari NE→EN items; do not gold-label raw YouTube roman text.
6. Two reviewers; freeze when n=100 filled; never train on this set.

## Datasets that do **not** replace this gold set

- No public EN→NE formal/informal MT bench with verb agreement labels
- Roman NE→EN gold must be hand-curated (transliteration lexicons are auxiliary only)
- `himalaya-ai/nepali-honorific-bench` is a sanity check, not translation gold

## Running eval

Harness TBD. Until then: qualitative review of filled seeds + honorific spot checks.

## Sensitive

Keep `references.jsonl` private if this is a true holdout. Sources alone are usually safe to share.
