# model-ship: Train / export only when artifacts exist

## Goal
Keep the FT → ONNX → `mobile/assets/models/` path coherent with INTENT. Improve scripts and mix **or** run eval if weights are present. Do not pretend a GPU job ran.

## Context
- Paths: `training/`, `docs/OFFLINE_IOS.md`, `scripts/prepare_offline_models.md`, `benchmarks/eval_it2_gold.py`
- Rules: LoRA, never `merge_and_unload`; INT8 first; sentence-level; both directions
- Gold is the ship gate. FLORES is not.

## Done when
Lane 5 checklist in `.agent/DONE.md`.

## Milestones
- [ ] Confirm artifacts on disk (merged IT2, LoRA, ONNX). If missing, stop with a blocker after documenting the exact path
- [ ] If present: run the smallest gold eval that is honest
- [ ] If missing: tighten export/FT docs and scripts only — no fake metrics
- [ ] Independent review

## Progress
Not started.

## Surprises & discoveries

## Decision log

## Commands that actually ran (paste)

## Remaining work
All milestones.

## Blockers
