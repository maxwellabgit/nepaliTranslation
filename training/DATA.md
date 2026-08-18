# Data for on-device EN↔NE

## What we ship today

| Asset | Role | Quality |
|-------|------|---------|
| IndicTrans2 dist-200M INT8 ONNX (both directions) | Free-form MT | Gold Devanagari NE→EN ~65% chrF; EN→NE ~60% |
| Meaning bank (curated traveler/conversation meanings) | Exact phrase overlay + Roman lexicon | High — human-style Roman |
| Phrasebook + word lexicon | Fallback when the model is cold | High on traveler lines |
| Chat-Roman → Devanagari | Pre-step so the NE→EN model sees Devanagari | Lexicon + syllable parser |

## CPU training mix (this machine)

See [`CPU_FT_JOB.md`](CPU_FT_JOB.md). The mix is **164 curated meanings** → 581 unique examples → **1544 EN→NE + 1352 NE→EN** after upsample. Quality over quantity; OPUS-100 / Global Voices / Titung are gone.

| File | Role |
|------|------|
| `meaning_bank.jsonl` | Curated provenances only (`hand_priority_seed`, `assistant_curated`, `recovered_site_labels_and_manual_normalization`, `law_gov`) plus traveler seeds |
| `train_user_conversation_seeds.jsonl` | 150 gold-candidate traveler phrases |
| `train_law_gov_en_ne.jsonl` | 60 short gov / site labels |
| `train_clean_en-ne.jsonl` / `train_clean_ne-en.jsonl` | Expanded + upsampled LoRA examples |
| `cpu_mix_manifest.json` | Counts |

Gold holdout strings in `benchmarks/data/gold_train_blocklist.json` **and** a live scan of `benchmarks/gold/` are never trained on. `prepare_cpu_mix.py`, `prepare_ft_data.py`, `prepare_gold_domain_data.py`, and `build_meaning_bank.py` scan live gold (plus the blocklist file). `scrub_gold_from_train.py` reads the blocklist file only — refresh it with `python benchmarks/check_gold_integrity.py --update-freeze` before scrubbing. Domain FT (`finetune_it2_gold.py` / `train_gold_domain.jsonl`) is holdout-blocked conversation data — not the eval set.

## Deleted junk (do not recreate)

These were OPUS-100 software UI, mechanical Roman of that UI, Global Voices news, or expansions of a contaminated bank:

- `train_en_ne.jsonl` / `val_en_ne.jsonl`
- `train_gold_domain.jsonl` / `val_gold_domain.jsonl`
- `train_roman_ne_en.jsonl`
- `train_global_voices_en_ne.jsonl`
- `train_meanings_*.jsonl` / `val_meanings_*.jsonl`

Titung (`training/harvest_parallel.py` → `external/titung_ne_en_short.jsonl`) stays gitignored. Even after length filters it is Bible / KDE / legal — **do not train on it**.

Old rebuild scripts refuse unless you pass `--force-opus-junk`.

## Better data we can add later (GPU / larger RAM)

| Corpus | License | Use |
|--------|---------|-----|
| **Meaning bank** + in-app Meaning Review | ours | Always include; this is the product domain |
| **[ai4bharat/BPCC](https://huggingface.co/datasets/ai4bharat/BPCC)** `npi_Deva` | CC | Filter to 4–25 tokens, drop gold duplicates |
| **FLORES+ / FLORES-200 `npi_Deva`** | CC | Held-out only — never train |

## How to refine the on-device model

1. **Do not merge LoRA with `merge_and_unload`** — it corrupts IndicTrans2. Keep adapters; ship base INT8 until a verified fuse path exists.
2. **Train on the CPU clean mix**, not OPUS UI.
3. **Roman is a pre-step, not a second MT model.** Chat Roman → Devanagari (lexicon + parser) → `indic-en`.
4. **Eval gates:** `benchmarks/eval_it2_onnx.py` (ship-exact INT8) and `benchmarks/eval_it2_gold.py --systems it2_base,it2_cpu`.
5. On-device retraining is not practical (200M + ORT). Retrain here, re-export INT8, bump the IPA.

## Commands

```bash
python training/prepare_cpu_mix.py
python training/finetune_it2_cpu.py --dry-run
python training/export_ondevice_lexicon.py   # regenerates mobile/src/mt/generated/meaningLexicon.json
```
