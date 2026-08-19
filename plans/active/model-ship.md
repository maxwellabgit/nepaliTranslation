# model-ship: Inventory first; no fake gold eval

## Goal
Keep the FT → ONNX → `mobile/assets/models/` path coherent with INTENT. Improve scripts and mix **or** run eval if weights are present. Do not pretend a GPU job ran.

## Context
- Paths: `training/`, `docs/OFFLINE_IOS.md`, `scripts/prepare_offline_models.md`, `benchmarks/eval_it2_gold.py`
- Rules: LoRA, never `merge_and_unload`; INT8 first; sentence-level; both directions
- Gold is the ship gate. FLORES is not.
- This cloud box: no CUDA, no torch, empty `training/artifacts/` (only `.gitkeep`), no `mobile/assets/models/`

## Done when
Lane 5 checklist in `.agent/DONE.md`.

- [x] Still one IT2 family; LoRA not `merge_and_unload` (docs + `finetune_it2_gold.py` header)
- [x] INT8-first; gold register/names survive any quant discussion (no new quant; docs say measure after quantize when eval can run)
- [x] Export path still ends at `mobile/assets/models/`
- [x] Gold eval vs frozen baseline if weights exist; **otherwise explicit GPU/artifact blocker**
- [x] No new PC/cloud inference in the product path
- [ ] Independent review

## Milestones
- [x] Confirm artifacts on disk (merged IT2, LoRA, ONNX). If missing, stop with a blocker after documenting the exact path
- [x] If present: run the smallest gold eval that is honest — **skipped; nothing present**
- [x] If missing: tighten export/FT docs and scripts only — no fake metrics
- [ ] Independent review

## Progress
2026-08-19: Inventory only. `python training/check_ship_artifacts.py` → exit 1 BLOCKED. Docs aligned to real paths (base merged dirs, LoRA adapters, Hari31416 INT8 file list). `eval_it2_gold.py` not run. No gold-reference edits. No TestFlight bump.

## Surprises & discoveries
- `scripts/prepare_offline_models.md` pointed at nonexistent `it2_indic_en_ne_ft` / single `model.onnx`. The app requires encoder/decoder/past + `.onnx.data` sidecars (`modelAssets.ts`).
- Whisper prep downloaded stock `small-q5_1`, which OFFLINE_IOS already calls unusable on Nepali.
- `docs/OFFLINE_IOS.md` still said ~100/class and “next: four register checkpoints,” which contradicts ARCHITECTURE and the lane-1 freeze.
- `finetune_it2_gold.py` docstring said “merged checkpoints” while the body saves LoRA only.

## Decision log
- 2026-08-19: Do not fetch INT8 from Hugging Face in this lane just to make the inventory green. That would hide the founder-machine blocker and is a large download, not an eval.
- 2026-08-19: Do not add `check_ship_artifacts.py` to GitHub Actions — it is supposed to fail on a slim checkout.
- 2026-08-19: Ship path remains base INT8 ONNX; adapters stay unmerged.

## Commands that actually ran (paste)

```
$ python3 training/check_ship_artifacts.py
... json report ...
  "gpu_probe": { "torch": false, "cuda": false }
  "runnable_gold_eval": false
  "runnable_onnx_ship": false
  blockers:
    - No PyTorch in this environment — cannot load IndicTrans2 for eval_it2_gold.py.
    - No eval checkpoints under training/artifacts/ (need it2_en_indic_merged + it2_indic_en_merged, or LoRA adapters).
    - ONNX ship bundles incomplete under mobile/assets/models/it2_en_indic and it2_indic_en.
result: BLOCKED (nothing to eval or ship from this box)
EXIT:1

$ python3 -m py_compile training/check_ship_artifacts.py training/finetune_it2_gold.py
PY:0
```

`eval_it2_gold.py` **not run**. No chrF numbers.

## Remaining work
- On a machine with `training/download_it2.py` output (or LoRA + base): run `eval_it2_gold.py --systems it2_base` against the live freeze; keep or revert on that number.
- `cd mobile && node scripts/eas_fetch_it2_models.mjs` on the founder box if EAS should pack INT8 (large; not done here).
- Independent review round 2 after this work is committed (round 1 FAIL: `origin/main...HEAD` empty).

## Blockers (concrete; cannot be solved from this repo)
1. **No PyTorch / no CUDA** on this cloud agent VM.
2. **`training/artifacts/` empty** except `.gitkeep` — no `it2_en_indic_merged`, `it2_indic_en_merged`, or LoRA adapters (gitignored).
3. **`mobile/assets/models/` absent** — no INT8 ONNX, no Whisper ggml.
4. Therefore **no honest gold eval** and **no on-device weight promotion** from this run.
