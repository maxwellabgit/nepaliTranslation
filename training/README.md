# Fine-tune IndicTrans2 for on-device iOS

LoRA fine-tune English ↔ Nepali (Devanagari) checkpoints for export to **ONNX** and bundling in the Expo app (`mobile/assets/models/`). Training runs on a dev GPU machine; inference is **on iPhone only** — no `serve.py`, PC backend, or cloud API in the product path.

## Data

```powershell
$env:HF_HUB_DISABLE_XET = "1"
python training/prepare_ft_data.py --opus-max 80000 --nllb-max 30000
# optional extra NLLB:
python training/append_nllb.py
```

- **Train:** OPUS-100 `en-ne` (+ NLLB HQ `npi_Deva` when available)
- **Held out of train:** gold-standard eval under `benchmarks/gold/` (and legacy `benchmarks/data/ne_quality_bench.json` blocklist)

BPCC seed is gated on Hugging Face (needs `huggingface-cli login`).

## Train (LoRA → merged checkpoints)

```powershell
$env:HF_HUB_DISABLE_XET = "1"
python training/finetune_lora.py --directions en-ne,ne-en --max-train 30000 --epochs 1
```

Outputs (dev machine):

- `training/artifacts/it2_en_indic_ne_ft/` — EN→NE
- `training/artifacts/it2_indic_en_ne_ft/` — NE→EN

## Export to mobile

1. Export each merged checkpoint to ONNX (see [`scripts/prepare_offline_models.md`](../scripts/prepare_offline_models.md)).
2. Copy ONNX graphs + tokenizers into `mobile/assets/models/`.
3. Rebuild iOS via EAS; verify on device in airplane mode.

## Eval gate

**Primary:** gold standard per class — [`benchmarks/gold/`](../benchmarks/gold/).

**Secondary:** corpus regression during training:

```powershell
python benchmarks/run_ne_quality_bench.py
```

Ship a new on-device model only when gold (and agreed secondary) baselines are met or beaten.
