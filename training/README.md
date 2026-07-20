# Fine-tune for on-device EN ↔ NE (commercial)

## Active job (gold-domain IndicTrans2)

```powershell
# 1) Download MIT bases (HF gate for BOTH directions)
python training/download_it2.py

# 2) Conversational train set (gold blocked)
python training/prepare_gold_domain_data.py

# 3) LoRA FT both directions
python training/finetune_it2_gold.py --directions en-ne,ne-en --max-train 18000 --epochs 2

# 4) Gold eval
python benchmarks/eval_it2_gold.py --systems phrasebook,it2_base,it2_ft,it2_ft_notags --tag it2_gold_post
```

- Orchestrator: `python training/run_it2_gold_job.py`
- Continue NE→EN: `python training/continue_it2_ne_en.py`

Outputs (MIT, shippable):

- `training/artifacts/it2_en_indic_gold_ft/`
- `training/artifacts/it2_indic_en_gold_ft/`

On-device export: [`ON_DEVICE_SHIP.md`](ON_DEVICE_SHIP.md)

## Why IndicTrans2 dist-200M

| Criterion | Choice |
|-----------|--------|
| License | **MIT** — commercial iOS/Android OK |
| Size | ~200M — ONNX INT8 fits phones |
| Quality | Best open Indic MT with Nepali |
| Gate | Accept **en-indic** and **indic-en** on HF |

Do **not** ship NLLB (CC-BY-NC). Research adapters live under `nllb600m_*`.

## Data rules

- Never train on `benchmarks/gold/` (blocklist + scrub)
- Short conversational pairs + register expand + roman NE→EN views
- Freeze checksums: `python benchmarks/freeze_gold_holdout.py`
