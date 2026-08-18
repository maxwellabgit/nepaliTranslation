# Gold standard eval (EN ↔ NE)

Private holdout for product quality decisions. **Original scaffold: 100/class.** Live frozen sizes are **137 / 139 / 133 / 134** (premium word-choice slice included). See each class `manifest.json` and `benchmarks/results/gold_freeze.json`.

## Two different gates — do not mix them

| Gate | What it is | Where |
|------|------------|--------|
| **Phrasebook floor** | v1.4.0 in-app phrase table on the original **100/class (400)** scaffold, frozen 2026-07-20 | [`../results/gold_baseline.md`](../results/gold_baseline.md) |
| **IT2 ship-gate freeze** | SHA256 + counts of the **live holdout** (543 rows after the 2026-07-25 Kathmandu items). On-device IndicTrans2 is judged against this set, not against the phrasebook table. | [`../results/gold_freeze.json`](../results/gold_freeze.json) |

Beating the phrasebook floor is necessary and **not** the same claim as matching a prior IT2 run on the frozen holdout.

Integrity (no GPU): `python benchmarks/check_gold_integrity.py`  
Refresh freeze + blocklist only after a clean audit: `python benchmarks/check_gold_integrity.py --update-freeze`

## Why these classes

| Class | Why | Frozen n (premium) |
|-------|-----|--------------------|
| `en_ne_formal` | English speaker wants respectful Nepali (`तपाईं` + verb agreement) | 137 (35) |
| `en_ne_informal` | Peer/friend Nepali (`तिमी` + verb agreement) | 139 (37) |
| `ne_en_deva` | Devanagari Nepali → English (core direction) | 133 (32) |
| `ne_en_roman` | Chat-style Roman Nepali → English (common diaspora typing) | 134 (33) |

**v1 languages:** English ↔ Nepali only. NPHC 2021: Nepali is the largest mother tongue (~44.9%) and the national lingua franca; Maithili / Bhojpuri / Tharu are later expansions.

## Human review (current)

Human review now runs through the in-app **Meaning Review** flow (Settings → Review training data), which syncs each Accept/Skip to the review server (`training/review_server.py`). The old in-app gold-pack review screen (`pack_gold_for_app.py` / `apply_app_reviews.py`) was removed.

**Sentence-level rule still applies:** the IT2 FT unit is one sentence (model max 256 positions, FT truncates ~96); split or trim multi-sentence rows before they enter training data.

Provenance / dataset trust ladder: `training/ARCHITECTURE.md`.

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

Holdout integrity (CI-style, no GPU): `python benchmarks/check_gold_integrity.py`

Model eval (needs weights on disk): `python benchmarks/eval_it2_gold.py --classes en_ne_formal en_ne_informal ne_en_deva ne_en_roman` (chrF++ + honorific checks; see `--help` for adapter/base options).

Phrasebook floor (historical v1.4.0 numbers live in `gold_baseline.md`): `benchmarks/score_phrasebook_gold.py` — do not treat a new phrasebook run as the IT2 ship gate.

Ship-exact INT8 ONNX graphs (what the app runs): `python benchmarks/eval_it2_onnx.py --model-dir <onnx dir> --direction ne-en`. Spoken-Nepali STT checks: `benchmarks/fetch_nepali_speech_samples.py` + `benchmarks/eval_whisper_nepali.py`.

## Sensitive

Keep `references.jsonl` private if this is a true holdout. Sources alone are usually safe to share.
