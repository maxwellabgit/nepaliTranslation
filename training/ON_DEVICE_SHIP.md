# On-device IndicTrans2 ship checklist (iOS + Android)

## Model

- **Family:** `ai4bharat/indictrans2-*-dist-200M` (MIT — commercial OK)
- **Fine-tune:** LoRA only (`python training/finetune_it2_cpu.py` or `run_it2_gold_job.py`). Never `merge_and_unload`.
- **Checkpoints (gitignored; inventory: `python training/check_ship_artifacts.py`):**
  - Base: `training/artifacts/it2_en_indic_merged/` + `it2_indic_en_merged/`
  - Optional LoRA: `it2_cpu_*_lora/adapter`, `it2_en_indic_gold_ft/`, `it2_indic_en_gold_ft/`

## Export ONNX (both directions)

```powershell
pip install "optimum[onnxruntime]" onnx onnxruntime
# Prefer Hari31416/indictrans2-onnx-export style encoder+decoder+past if optimum fails on custom code.
# Fallback: scripts/prepare_offline_models.md
```

Bundle under:

```
mobile/assets/models/it2_en_indic/{encoder,decoder,tokenizer…}
mobile/assets/models/it2_indic_en/{…}
```

Target INT8 dynamic weights for phone size; measure chrF on gold after quantize.

## App wiring

1. Load once in `TranslationEngine.warmUp()` (persistent session).
2. Request IDs + cancel stale results.
3. Formality via `<formal>` / `<informal>` source prefixes (EN→NE).
4. Roman NE→EN: roman→Devanagari normalize then NE→EN model (or roman-trained NE→EN).
5. Phrasebook remains offline fallback if model assets missing.

## EAS

- iOS: production profile + `NSPhotoLibraryUsageDescription` (ITMS-90683 fixed)
- Android: add production submit once Play Console linked; test on **4 GB** devices

```powershell
cd mobile
npx eas-cli build --platform all --profile production
```

## Gate before ship

Run `python training/check_ship_artifacts.py` first. If it is BLOCKED, do not fill this table with guesses.

| Gate | Target |
|------|--------|
| Gold overall chrF | Beat `it2_base` on the live freeze (`gold_freeze.json`) when eval actually ran |
| Formal तपाईं rate | >70% on formal class (from `eval_it2_gold.py`, not invented) |
| Informal (no तपाईं leak) | >70% OK |
| p95 latency (20 tok) | <1.5s mid-range phone (device) |
| Peak RAM | <700 MB (device) |
| Crash rate | 0 on smoke suite (device) |

## Serving: our fine-tune on edge compute

See full write-up in `training/ARCHITECTURE.md`. Summary: IndicTrans2 dist-200M MIT LoRA, served on-device/edge — not a third-party MT API.

`PeftModel.merge_and_unload()` **corrupts** IndicTrans2 generation (empty / `" "` loops). Keep adapters and load:

```python
base = AutoModelForSeq2SeqLM.from_pretrained(BASE, trust_remote_code=True)
model = PeftModel.from_pretrained(base, ADAPTER_DIR)
```

Ship ONNX from the **base** dist-200M first (strong on gold), then fuse adapters only with a verified export path — never ship a broken merged safetensors folder.
