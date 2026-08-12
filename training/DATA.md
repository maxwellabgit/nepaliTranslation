# Data for on-device EN↔NE

## What we ship today

| Asset | Role | Quality |
|-------|------|---------|
| IndicTrans2 dist-200M INT8 ONNX (both directions) | Free-form MT | Gold Devanagari NE→EN **65.6% chrF**; EN→NE ~60% |
| Meaning bank (1,422 traveler/conversation meanings) | Exact phrase overlay + Roman lexicon | High — human-style Roman |
| Phrasebook + word lexicon | Fallback when the model is cold | High on ~200 traveler lines, empty elsewhere |
| Chat-Roman → Devanagari | Pre-step so the NE→EN model sees Devanagari | Lexicon + syllable parser (replaces the old letter-greedy matcher) |

## What we already have that is the *wrong* domain

`training/data/train_en_ne.jsonl` (~108k) is **OPUS-100 software UI** ("Fixed Width Font", "Azimuth:"). Fine-tuning on it makes the model more literal, not more conversational. `train_roman_ne_en.jsonl` is the same OPUS rows run through a mechanical romanizer (`bhaidaiyao anaukaramanaikaa`) — do not train Roman on that.

## Better data we can add (next GPU LoRA)

| Corpus | License | Size | Use |
|--------|---------|------|-----|
| **Meaning bank** (`training/data/meaning_bank.jsonl`) | ours | 1,422 meanings × formal/informal/Roman | Always include; this is the product domain |
| **Titung short** (`training/harvest_parallel.py`) | Apache-2.0 | ~8k short NE–EN sentences after legal-text filter | Formal written Nepali, useful for NE→EN |
| **[ai4bharat/BPCC](https://huggingface.co/datasets/ai4bharat/BPCC)** | CC | large, `npi_Deva` slice | Best mined bitext; filter to 4–25 tokens, drop duplicates vs gold |
| **FLORES+ / FLORES-200 `npi_Deva`** | CC | 2,009 eval sentences | Held-out only — never train |
| In-app **Meaning Review** + "mark incorrect" / "to training" | ours | grows with testers | Highest-value once ≥100 accepted edits |

## How to refine the on-device model

1. **Do not merge LoRA with `merge_and_unload`** — it corrupts IndicTrans2. Keep adapters; ship base INT8 until a verified fuse path exists.
2. **Train on meanings + BPCC-filtered + Titung-short**, not OPUS UI.
3. **Roman is a pre-step, not a second MT model.** Chat Roman → Devanagari (lexicon + parser) → `indic-en`. Expanding `meaning_bank` Roman fields beats training on fake Roman.
4. **Eval gates:** `benchmarks/eval_it2_onnx.py` (ship-exact INT8) and `benchmarks/eval_it2_gold.py` (fp16). Roman class must be scored *after* the app's `romanToDevanagari`.
5. On-device retraining is not practical (200M + ORT). Retrain in the cloud, re-export INT8, bump the IPA.

## Commands

```bash
python training/export_ondevice_lexicon.py   # regenerates mobile/src/mt/generated/meaningLexicon.json
python training/harvest_parallel.py          # Titung short seed → training/data/external/
python training/build_meaning_bank.py        # after Meaning Review imports
```
