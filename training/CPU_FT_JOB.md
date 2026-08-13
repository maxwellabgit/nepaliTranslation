# CPU fine-tune job (this machine)

This cloud VM is **4 CPU cores, ~15 GB RAM, no CUDA**. The job is IndicTrans2 dist-200M LoRA on the cleaned traveler mix: **165 meanings**, 584 unique examples, **1552 EN→NE + 1356 NE→EN** after upsample. Quality over quantity; OPUS-100 / Global Voices / Titung are gone.

On-device ship stays **base INT8 ONNX**. This run saves LoRA adapters only (`PeftModel.from_pretrained`). Do not `merge_and_unload`.

## One command

```bash
python training/download_it2.py
python training/prepare_cpu_mix.py
python training/finetune_it2_cpu.py --directions en-ne,ne-en
python benchmarks/eval_it2_gold.py --systems it2_base,it2_cpu --tag cpu_clean
```

Dry-run (no weight load, no overnight):

```bash
python training/prepare_cpu_mix.py
python training/finetune_it2_cpu.py --dry-run
```

## Mix

| Source | Role |
|--------|------|
| `meaning_bank.jsonl` provenances `hand_priority_seed`, `assistant_curated`, `recovered_site_labels_and_manual_normalization`, `law_gov` | Product meanings |
| `train_user_conversation_seeds.jsonl` | Traveler phrases (formal/informal) |
| `train_law_gov_en_ne.jsonl` | Short Nepal gov / site labels |
| Gold blocklist | Never train on `benchmarks/data/gold_train_blocklist.json` |

Expansion: `<formal> EN → ne_formal`, `<informal> EN → ne_informal`, Devanagari → EN. Light Roman → EN only on travel/health/questions (the app already romanizes to Devanagari at inference). Priority surfaces upsample 8×, others 4×. Val is 10% of meaning IDs (no leakage).

## Hardware defaults (`finetune_it2_cpu.py`)

| Knob | Value | Why |
|------|-------|-----|
| batch | 1 | 200M fp32 + activations on 15 GB |
| grad_accum | 8 | Effective batch 8 |
| max_length | 64 | Short traveler sentences |
| LoRA | r=16, `q_proj,v_proj` | Small adapter, CPU-friendly |
| fp16 / pin_memory / grad checkpoint | off | CPU |
| epochs | 3 | Small mix; stop if val loss rises |

Expect **about 1–3 hours per direction** on this box. Adapters land in:

- `training/artifacts/it2_cpu_en_ne_lora/adapter`
- `training/artifacts/it2_cpu_ne_en_lora/adapter`

## Do not train on

- OPUS-100 UI (`train_en_ne.jsonl` — deleted)
- Mechanical Roman of OPUS
- Global Voices news alignments
- Titung harvest (Bible/KDE/legal even after length filters)
- FLORES / gold bench strings

Old rebuild scripts (`prepare_ft_data.py`, `prepare_gold_domain_data.py`, `append_nllb.py`, `prepare_overnight_hybrid.py`) refuse unless you pass `--force-opus-junk`.
