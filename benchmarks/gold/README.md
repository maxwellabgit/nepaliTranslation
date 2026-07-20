# Gold standard eval (EN ↔ NE)

Private holdout for product quality decisions. **~100 base + premium word-choice slice per class** (see manifests for exact `n_filled` / `n_premium`).

## Why these classes

| Class | Why |
|-------|-----|
| `en_ne_formal` | English speaker wants respectful Nepali (`तपाईं` + verb agreement) |
| `en_ne_informal` | Peer/friend Nepali (`तिमी` + verb agreement) |
| `ne_en_deva` | Devanagari Nepali → English (core direction) |
| `ne_en_roman` | Chat-style Roman Nepali → English (common diaspora typing) |

**v1 languages:** English ↔ Nepali only. NPHC 2021: Nepali is the largest mother tongue (~44.9%) and the national lingua franca; Maithili / Bhojpuri / Tharu are later expansions.

## In-app human review (current)

1. Pack: `python benchmarks/pack_gold_for_app.py` → `mobile/assets/gold/review_pack.json`
2. In the app: top-right **▣** → password `1234` → mark **Correct** or edit + **Save & complete**
3. **Sentence-level:** multi-sentence rows are flagged (IT2 FT unit = one sentence; model max 256 positions, FT truncates ~96). Prefer **Split into N pairs** when both sides align, or trim to one sentence.
4. Export JSON → `python benchmarks/apply_app_reviews.py export.json` (writes `human_gold` + `__sN` split children)
5. After **all** benchmark classes are reviewed, open training-data review.
6. Provenance / dataset trust ladder: pack `dataset_catalog` + `training/ARCHITECTURE.md`.

Settled model for FT + edge: **IndicTrans2 dist-200M (MIT)**.

## Layout

```
benchmarks/gold/
  schema.json
  en_ne_formal/{manifest.json,sources.jsonl,references.jsonl}
  en_ne_informal/...
  ne_en_deva/...
  ne_en_roman/...   # sources include roman + optional deva normalization
```

Base rows: `status: reviewed`. Premium slice: `tier: premium_word_choice`.  
Expand/prune: `python benchmarks/expand_gold_premium.py`, `python benchmarks/prune_expand_premium.py`.  
Source research: `benchmarks/PREMIUM_SOURCES.md`.

## Curation recipe

1. Prefer **hand-authored / work-for-hire** references for commercial clarity.
2. Seed from **IN22-Conv** / **FLORES+ `npi_Deva`** / **BPCC daily** (HF token in `benchmarks/.env`) — then **rewrite** for register; never paste verbatim into gold.
3. **Do not** treat FLORES alone as conversational gold; eval-integrity terms forbid training on it.
4. Formal/informal: same English intent, different Nepali pronouns **and** verbs. Reject mixed register (तिमी + गर्नुहोस्).
5. Roman: WhatsApp-style chat roman, not ISO transliteration; pair with Devanagari.
6. Adversarial prune worst **2–5%** of premium (calques, dual-sense refs, semantic dups); never train on this set.

## Datasets that do **not** replace this gold set

- No public EN→NE formal/informal MT bench with verb agreement labels
- Roman NE→EN gold must be hand-curated (transliteration lexicons are auxiliary only)
- `himalaya-ai/nepali-honorific-bench` is a sanity check, not translation gold

## Running eval

Harness TBD. Until then: qualitative review of filled seeds + honorific spot checks.

## Sensitive

Keep `references.jsonl` private if this is a true holdout. Sources alone are usually safe to share.
