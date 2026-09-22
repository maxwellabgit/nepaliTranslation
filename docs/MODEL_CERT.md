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

## G4 measured results (2026-09-22)

Ran `python benchmarks/certify_ship_artifacts.py` against the exact pinned
IT2-dist-200M ONNX int8 weights fetched from Hugging Face at the manifest's
frozen revisions. Weights hashes matched the manifest. Full artifact is
committed to `benchmarks/results/ship_cert_last.json`.

| Class | Direction | Measured chrF | Floor | Register | Verdict |
|-------|-----------|---------------|------:|----------|---------|
| `en_ne_formal` | EN → NE formal | 0.4468 | 0.55 | तपाईं 0.7% (floor 15%) | **FAIL** |
| `en_ne_informal` | EN → NE informal | 0.4440 | 0.50 | तिमी 0.0% (floor 10%) | **FAIL** |
| `ne_en_deva` | NE Devanagari → EN | 0.6111 | 0.55 | — | **PASS** |
| `ne_en_roman` | Roman NE → EN | 0.4248 | 0.40 | — | **PASS** |

Overall verdict: `passed=false`. Two of four classes are below the pre-declared
ship floor. `en_ne_formal` and `en_ne_informal` also miss their register floors:
the base int8 export does not produce **तपाईं** or **तिमी** at meaningful rates,
so register-controlled EN→NE is not yet ship quality.

## G4 conclusion

- Schema, freeze counts, and manifest hash pins are green (validated in CI).
- Exact ONNX artifacts do NOT meet the ship gate for `en_ne_formal` and
  `en_ne_informal`. Do not ship, and do not invent higher numbers.
- `ne_en_deva` and `ne_en_roman` meet floors under the same run.

## Blockers to close the gate

1. Register-aware EN→NE quality lift for `en_ne_formal` and `en_ne_informal`
   (candidates: register-conditioned decoding hints, glossary/postedit for
   pronouns, targeted fine-tune, or an updated ONNX export). Falls under
   the `model-ship` and `mt-accuracy` lanes, not G4.
2. Physical-device latency / RAM / thermal / crash-free / low-storage /
   offline-restart evidence on the same TestFlight build (`DEVICE_PROOF.md`).
3. Re-run this cert after every artifact swap; never edit `benchmarks/gold/`
   to raise a score.

## Honesty

| Claim | Status |
|-------|--------|
| Thresholds pre-declared for four gold classes | **Source-proven** |
| Manifest revision + SHA-256 pins validate in CI | **Source-proven** (`check_model_hash.mjs`) |
| Exact bundled ONNX graphs meet floors on frozen gold | **FAIL** (G4 2026-09-22 run: `en_ne_formal` 0.4468 / `en_ne_informal` 0.4440) |
| Physical-device latency / RAM / thermal for the same artifacts | **DEVICE_PROOF** — human, still open |

Do not treat phrasebook scores, FLORES, or Windows Playwright as this gate.
