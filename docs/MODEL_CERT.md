# Model certification (F9 ship gate)

Exact release artifacts for on-device IndicTrans2 must clear the **four-class frozen gold** holdout before a build may claim ship quality. Never edit `benchmarks/gold/` references to raise a score. Never invent chrF numbers when weights or GPU are missing.

Product boundary: [`.governance/INTENT.md`](../.governance/INTENT.md). Holdout freeze: [`benchmarks/results/gold_freeze.json`](../benchmarks/results/gold_freeze.json). Pins: [`mobile/src/mt/onnx/it2-release-manifest.json`](../mobile/src/mt/onnx/it2-release-manifest.json).

## Pre-declared numeric gates

Machine-readable copy: [`benchmarks/ship_thresholds.json`](../benchmarks/ship_thresholds.json).

| Class | Direction | Min mean chrF (char trigram) | Register extras |
|-------|-----------|-----------------------------:|-----------------|
| `en_ne_formal` | EN → NE formal | **0.55** | तपाईं rate ≥ 0.15; तँ rate = 0 |
| `en_ne_informal` | EN → NE informal | **0.50** | तिमी rate ≥ 0.10; तँ rate = 0 |
| `ne_en_deva` | NE Devanagari → EN | **0.55** | — |
| `ne_en_roman` | Roman NE → EN (app romanizer first) | **0.40** | Requires shipped roman→Devanagari path |

Metric matches `benchmarks/eval_it2_onnx.py` / `eval_it2_gold.chr_f` (not sacrebleu chrF++). Floors beat the historical phrasebook scaffold and sit below prior measured IT2 / INT8 ONNX peaks so a real ship eval can still fail honestly.

**Artifact family:** `IndicTrans2-dist-200M-ONNX-int8` per the release manifest (immutable HF revision + SHA-256 per file).

## How to run

```powershell
# Always: gold integrity + manifest pins (no GPU). Soft-fails with BLOCKER when weights absent.
python benchmarks/certify_ship_artifacts.py

# When both ONNX dirs exist under mobile/assets/models/:
python benchmarks/certify_ship_artifacts.py --require-weights
```

Exit codes:

| Code | Meaning |
|-----:|---------|
| 0 | Schema/pins OK; weights missing → printed `BLOCKER:` (soft); or weights present and all class floors met |
| 1 | Integrity/pin/schema failure, or weights present but a class floor failed |

## Honesty

| Claim | Status |
|-------|--------|
| Thresholds pre-declared for four gold classes | **Source-proven (F9)** |
| Manifest revision + SHA-256 pins validate in CI | **Source-proven** (`check_model_hash.mjs`) |
| Exact bundled ONNX graphs meet floors on frozen gold | **Blocked** until `mobile/assets/models/it2_*` weights exist on the eval host |
| Physical-device latency / RAM / thermal for the same artifacts | **F10 / DEVICE_PROOF** — human |

Do not treat phrasebook scores, FLORES, or Windows Playwright as this gate.
