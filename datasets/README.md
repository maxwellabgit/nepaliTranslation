# Datasets pipeline (this machine)

Three folders under `datasets/`. Nothing here is shipped to the phone until you promote it.

```
datasets/
  gold/          # trusted human / primary sources (train-eligible after review)
  synthetic/     # student (on-device 200M) translations + teacher (1B) review
  benchmarks/    # model history — fresh runs only (do not mix with repo benchmarks/gold edits mid-flight)
```

## Distillation / review teachers

| Role | Model | HF id |
|------|--------|--------|
| **Ship / student** | IndicTrans2 dist-200M | `ai4bharat/indictrans2-en-indic-dist-200M` |
| **Distill teacher** | IndicTrans2 **1B** (same family) | `ai4bharat/indictrans2-en-indic-1B` |
| **Synthetic QC on this PC** | Same 1B (overnight GPU) | same |
| **Optional API adjudicator** | Gemini / GPT-4o | hard cases only |

Same-family 1B → 200M is the right distillation path. Do **not** distill from NLLB or APIs into the ONNX student.

## Fair baseline sequence (locked)

1. **Now:** benchmark current on-device student vs **non-reviewed** gold → `datasets/benchmarks/runs/*_prereview/`
2. **Finish** Meaning / gold review (ruler only — does not train)
3. Re-bench **same** student checkpoint vs **reviewed** gold → `*_postreview/`
4. Train LoRA on `gold/` + teacher-approved `synthetic/`
5. Bench trained model → `*_posttrain/`

Never compare a new model to a moving gold set without a matching re-bench of the old model.

## Collecting training data initially

1. **Domain-balanced English seeds** (short, 1 sentence) in `gold/sources/english_seeds/`
2. **Student translate** → `synthetic/student_raw/` (200M, formal+informal)
3. **Teacher review** (1B) → `synthetic/teacher_reviewed/` (accept / rewrite / reject)
4. Promote accepted teacher rows into train JSONL via existing `build_meaning_bank.py` path
5. Human Meaning Review continues on the phone for high-value / flagged rows (UI shows **count done only**, not totals)

## Domains (balance targets)

travel · health · shopping · family · government · questions_requests ·  
pronouns_honorifics · numbers_money · core_grammar · emergencies · lodging · food

Short samples only (IT2 window-friendly). Quantity is fine; quality gates are teacher + human.
