# Prepare offline models (Whisper ggml + IndicTrans2 ONNX)

Export mobile-ready artifacts for the **on-device iOS app**. Outputs go under `mobile/assets/models/` (bundled in the IPA via `plugins/withIt2Models.js`, or first-launch download).

Inventory (no GPU, no scores):

```powershell
python training/check_ship_artifacts.py
```

Exit 0 only when both INT8 ONNX bundles are complete. Missing PyTorch weights is a blocker, not a quality number.

Hard rules: one IndicTrans2 dist-200M family, both directions; LoRA adapters only — **never** `merge_and_unload`; INT8 first; gold holdout is the ship gate (`benchmarks/check_gold_integrity.py` then `eval_it2_gold.py` when weights exist).

---

## 1. Whisper Nepali → ggml (for whisper.rn, not wired in the app yet)

Stock Whisper is unusable on Nepali (CER 100%+). Use `Dragneel/whisper-small-nepali` → ggml q5_1 (~190 MB, Apache-2.0). Score with `benchmarks/eval_whisper_nepali.py`.

Do **not** copy `ggml-small-q5_1.bin` from `download-ggml-model.py small-q5_1` and call it Nepali STT.

Convert (dev machine with whisper.cpp):

```powershell
# huggingface-cli download Dragneel/whisper-small-nepali
# python whisper.cpp/models/convert-h5-to-ggml.py <hf-dir> <whisper.cpp> .
# whisper-quantize ggml-model.bin ggml-ne-small-q5_1.bin q5_1
```

Copy to `mobile/assets/models/whisper/ggml-ne-small-q5_1.bin`. whisper.rn is not in `mobile/package.json` yet (separate lane).

---

## 2. IndicTrans2 → ONNX (what the app actually loads)

The app expects **encoder + decoder + decoder_with_past + shared .onnx.data + tokenizers**, not a single `model.onnx`. Names must match `mobile/src/mt/onnx/modelAssets.ts` / `mobile/scripts/eas_fetch_it2_models.mjs`:

```
mobile/assets/models/it2_en_indic/
mobile/assets/models/it2_indic_en/
```

### Checkpoints on the founder machine (gitignored)

| Role | Path |
|------|------|
| Base EN→Indic | `training/artifacts/it2_en_indic_merged` (`python training/download_it2.py`) |
| Base Indic→EN | `training/artifacts/it2_indic_en_merged` |
| CPU LoRA (optional) | `training/artifacts/it2_cpu_en_ne_lora/adapter` and `it2_cpu_ne_en_lora/adapter` |
| Gold-domain LoRA (optional) | `training/artifacts/it2_en_indic_gold_ft` / `it2_indic_en_gold_ft` — adapters, not merged safetensors |

`PeftModel.merge_and_unload()` corrupts IndicTrans2. Ship **base INT8 ONNX** first. Fuse adapters only with a verified export path.

### Fast path (base INT8, no local export)

```powershell
cd mobile
node scripts/eas_fetch_it2_models.mjs
```

Pulls `hari31416/indictrans2-en-indic-dist-200M-ONNX-int8` and `…-indic-en-…` into `mobile/assets/models/`. EAS `eas-build-pre-install` already runs this.

### Local export (only if you have merged **base** dirs)

Optimum often fails on IndicTrans custom code. Prefer the Hari31416-style encoder/decoder/past layout. If you must export:

```powershell
# Do not pass a LoRA folder as --model. Export base, keep adapters separate.
pip install optimum[onnxruntime] onnx onnxruntime
# See training/ON_DEVICE_SHIP.md — verify gold after any quantize.
```

---

## 3. Quality gate before shipping

```powershell
python benchmarks/check_gold_integrity.py
python training/check_ship_artifacts.py
python benchmarks/eval_it2_gold.py --systems it2_base --tag ship_check
```

Skip `eval_it2_gold.py` when `check_ship_artifacts.py` reports no checkpoints or no torch. Do not invent chrF.

Phrasebook floor (`results/gold_baseline.md` section 1) is **not** the IT2 ship gate. FLORES is not the ship gate.

Register probe: `benchmarks/honorific_probe.json` (qualitative).
