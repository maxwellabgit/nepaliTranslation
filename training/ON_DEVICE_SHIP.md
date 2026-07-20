# On-device IndicTrans2 ship checklist (iOS + Android)

## Model

- **Family:** `ai4bharat/indictrans2-*-dist-200M` (MIT — commercial OK)
- **Fine-tune:** `python training/run_it2_gold_job.py`
- **Checkpoints:**
  - `training/artifacts/it2_en_indic_gold_ft/`
  - `training/artifacts/it2_indic_en_gold_ft/`

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

| Gate | Target |
|------|--------|
| Gold overall chrF | Beat `it2_base` pre-FT |
| Formal तपाईं rate | >70% on formal class |
| Informal (no तपाईं leak) | >70% OK |
| p95 latency (20 tok) | <1.5s mid-range phone |
| Peak RAM | <700 MB |
| Crash rate | 0 on smoke suite |

## Serving: our fine-tune on edge compute

See full write-up in `training/ARCHITECTURE.md`. Summary: IndicTrans2 dist-200M MIT LoRA, served on-device/edge — not a third-party MT API.

`PeftModel.merge_and_unload()` **corrupts** IndicTrans2 generation (empty / `" "` loops). Keep adapters and load:

```python
base = AutoModelForSeq2SeqLM.from_pretrained(BASE, trust_remote_code=True)
model = PeftModel.from_pretrained(base, ADAPTER_DIR)
```

Ship ONNX from the **base** dist-200M first (strong on gold), then fuse adapters only with a verified export path — never ship a broken merged safetensors folder.
