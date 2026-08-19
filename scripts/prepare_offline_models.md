# Prepare offline models (Whisper ggml + IndicTrans2 ONNX)

Export mobile-ready artifacts for the **on-device iOS app**. Outputs go under `mobile/assets/models/` (bundled or first-launch download).

Assumes repo root `nepaliTranslation/` and Python with `torch`, `transformers`, `IndicTransToolkit` for local IT2 export.

---

## 1. Whisper Nepali → ggml (for whisper.rn, not wired as a native dep yet)

Stock Whisper small is unusable on Nepali (CER ~100%+ / Latin hallucinations). Use `Dragneel/whisper-small-nepali` → ggml q5_1 (`ggml-ne-small-q5_1.bin`, Apache-2.0). Score with `benchmarks/eval_whisper_nepali.py`.

Do **not** copy `models/ggml-small-q5_1.bin` from `download-ggml-model.py small-q5_1` and call it Nepali STT.

Convert (dev machine with whisper.cpp):

```powershell
# huggingface-cli download Dragneel/whisper-small-nepali
# python whisper.cpp/models/convert-h5-to-ggml.py <hf-dir> <whisper.cpp> .
# whisper-quantize ggml-model.bin ggml-ne-small-q5_1.bin q5_1
```

Copy into the app probe path:

```powershell
cd mobile
$env:WHISPER_GGML="C:\path\to\ggml-ne-small-q5_1.bin"
npm run fetch:whisper
node ./scripts/fetch_whisper_nepali.mjs --check
```

whisper.rn is not in `mobile/package.json` yet. `src/stt/nepaliAsr.ts` stays on typed fallback until the native module is linked **and** this ggml is on device.

---

## 2. IndicTrans2 → ONNX (for ONNX Runtime Mobile)

Use merged checkpoints from training export or base IT2 merges. Typical layout after fine-tune:

| Direction | Checkpoint (dev machine) |
|-----------|--------------------------|
| Indic → EN | `training/artifacts/it2_indic_en_ne_ft/` (or base merge) |
| EN → Indic | `training/artifacts/it2_en_indic_ne_ft/` (or base merge) |

### Export (Optimum example)

```powershell
cd c:\Users\maxwe\.cursor\nepaliTranslation
pip install optimum[onnxruntime] onnx onnxruntime

optimum-cli export onnx `
  --model training/artifacts/it2_indic_en_ne_ft `
  --task seq2seq-lm `
  --trust-remote-code `
  mobile/assets/models/it2_indic_en

optimum-cli export onnx `
  --model training/artifacts/it2_en_indic_ne_ft `
  --task seq2seq-lm `
  --trust-remote-code `
  mobile/assets/models/it2_en_indic
```

If `optimum-cli` fails on custom IndicTrans code, export encoder/decoder with `torch.onnx.export` and keep tokenizers beside the `.onnx` files.

### Quantize for mobile (optional)

```powershell
python -m onnxruntime.quantization.preprocess `
  --input mobile/assets/models/it2_en_indic/model.onnx `
  --output mobile/assets/models/it2_en_indic/model.pre.onnx

python -c "from onnxruntime.quantization import quantize_dynamic, QuantType; quantize_dynamic('mobile/assets/models/it2_en_indic/model.pre.onnx', 'mobile/assets/models/it2_en_indic/model.int8.onnx', weight_type=QuantType.QInt8)"
```

Repeat for `it2_indic_en`. Prefer separate encoder/decoder ONNX files if the RN binding expects them.

Keep IndicProcessor-compatible tokenization on device (`eng_Latn` / `npi_Deva` lang tags).

---

## 3. Quality gate before shipping

Run gold-standard eval per [`benchmarks/gold/README.md`](../benchmarks/gold/README.md). Corpus regression (optional during training):

```powershell
$env:HF_HUB_DISABLE_XET = "1"
pip install -r benchmarks/requirements.txt
python benchmarks/run_ne_quality_bench.py
```

For ONNX, score via a PyTorch twin of the same weights or add an ONNX inference path to the bench harness.

Register checks: `benchmarks/honorific_probe.json` (not a BLEU/chrF gate).
