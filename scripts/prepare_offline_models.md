# Prepare offline models (Whisper ggml + IndicTrans2 ONNX)

Commands to export mobile-ready artifacts. **Do not need to run these to develop against the PC backend** — only when bundling on-device STT/MT.

Assumes repo root `nepaliTranslation/` and Python with `torch`, `transformers`, `IndicTransToolkit` already working for local IT2.

---

## 1. Whisper small → ggml (for whisper.rn)

whisper.rn loads [ggerganov ggml](https://github.com/ggerganov/whisper.cpp) weights.

```powershell
# Clone whisper.cpp once (sibling or under third_party/)
git clone --depth 1 https://github.com/ggerganov/whisper.cpp.git third_party/whisper.cpp
cd third_party/whisper.cpp

# Download official small ggml (EN multilingual; covers Nepali reasonably for MVP)
# Or convert from HuggingFace openai/whisper-small:
pip install huggingface_hub
python models/download-ggml-model.py small

# Output typically:
#   models/ggml-small.bin
# Quantized (preferred for iPhone size/latency):
python models/download-ggml-model.py small-q5_1
#   models/ggml-small-q5_1.bin
```

Bundle `ggml-small-q5_1.bin` (or `ggml-small.bin`) into the Expo app assets / first-launch download. Point whisper.rn at that path.

Optional: build `whisper-cli` locally to smoke-test a Nepali wav before packaging.

---

## 2. IndicTrans2 → ONNX (for ONNX Runtime Mobile)

Source checkpoints (already merged for this repo):

| Direction | Directory |
|-----------|-----------|
| Indic → EN | `experiments/models/it2_indic_en_merged` |
| EN → Indic | `experiments/models/it2_en_indic_merged` |

### 2a. Export encoder/decoder (example with Optimum)

```powershell
cd c:\Users\maxwe\.cursor\nepaliTranslation
pip install optimum[onnxruntime] onnx onnxruntime

# Indic → EN
optimum-cli export onnx `
  --model experiments/models/it2_indic_en_merged `
  --task seq2seq-lm `
  --trust-remote-code `
  artifacts/onnx/it2_indic_en

# EN → Indic
optimum-cli export onnx `
  --model experiments/models/it2_en_indic_merged `
  --task seq2seq-lm `
  --trust-remote-code `
  artifacts/onnx/it2_en_indic
```

If `optimum-cli` fails on custom IndicTrans code, fall back to a small export script using `torch.onnx.export` on the encoder and decoder separately (same pattern as Hugging Face seq2seq ONNX guides), keeping `trust_remote_code` tokenizers beside the `.onnx` files.

### 2b. Quantize for mobile

```powershell
python -m onnxruntime.quantization.preprocess `
  --input artifacts/onnx/it2_en_indic/model.onnx `
  --output artifacts/onnx/it2_en_indic/model.pre.onnx

# Dynamic INT8 (adjust paths to actual encoder/decoder graph names from export)
python -c "from onnxruntime.quantization import quantize_dynamic, QuantType; quantize_dynamic('artifacts/onnx/it2_en_indic/model.pre.onnx', 'artifacts/onnx/it2_en_indic/model.int8.onnx', weight_type=QuantType.QInt8); print('wrote int8')"
```

Repeat for `it2_indic_en`. Prefer separate encoder/decoder ONNX files if the RN binding expects them.

### 2c. Package for the app

Copy into a versioned folder the mobile app can fetch or embed:

```
artifacts/mobile/
  whisper/ggml-small-q5_1.bin
  it2_indic_en/   # *.onnx + tokenizer + dict.*.json + config
  it2_en_indic/   # *.onnx + tokenizer + dict.*.json + config
```

Keep IndicProcessor-compatible tokenization on device (or pre-port the same lang tags `eng_Latn` / `npi_Deva` / `hin_Deva` used by `core/translation/indictrans2.py`).

---

## 3. Quality gate before shipping

```powershell
$env:HF_HUB_DISABLE_XET = "1"
pip install -r benchmarks/requirements.txt
python benchmarks/run_mt_bench.py --n 50
```

Compare chrF++ to [`benchmarks/results/flores_baseline.json`](../benchmarks/results/flores_baseline.json). **Must meet or beat** baseline on FLORES n=50 (see [`docs/OFFLINE_IOS.md`](../docs/OFFLINE_IOS.md)). For ONNX, either:

- run the harness against a PyTorch twin of the same weights, or
- add an ONNX inference path to the bench later and score the same slice.

Informal EN→NE pronoun rewrites are **not** part of the FLORES gate; use `benchmarks/honorific_probe.json` for register checks.
