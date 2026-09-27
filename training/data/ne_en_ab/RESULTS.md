# NE→EN A/B run `20260927T205343Z`

Compared with the unfine-tuned IndicTrans2 indic-en base (`training/artifacts/it2_indic_en_merged`). That base is the PyTorch source of the production NE→EN checkpoint. This score is greedy PyTorch decode (`num_beams=1`, `max_new_tokens=96`), chrF character trigrams via `eval_it2_gold.chr_f`. It is not an INT8 ONNX phone measurement. English→Nepali was not trained. Gold files were not edited.

Ship floors in `benchmarks/ship_thresholds.json`: Devanagari 0.55, Roman 0.40. The Roman floor assumes the phone Roman→Devanagari path (`requires_romanizer`).

## Decision

Keep candidate A and the phone Roman→Devanagari path. Direct Roman stays off. B’s direct Roman did not beat A’s phone-path Roman, and B’s blind Devanagari was below A.

Adapter (local, gitignored weights): `training/artifacts/ne_en_ab_20260927T205343Z/A/adapter`

## Data

Source sheet: the reviewed CSV, every filled Nepali surface, no register tag, same English target. Gold and public-benchmark rows were dropped (3838). Another 60 train examples matched the gold blocklist. The existing 16 validation meanings stayed out of training.

| Split | Rows |
|---|---:|
| Train A (Devanagari formal + informal) | 436 |
| Train B (A plus both Roman surfaces) | 732 |
| Blind dev (16 meanings × 4 surfaces) | 64 |

## Training log

First launch used microbatch 8 and died with `CUDA out of memory` on step 2 of 26 while casting activations, with about 12 GiB still reported free. The finished run used microbatch 4, gradient accumulation 8 (effective batch 32), gradient checkpointing, `dataloader_num_workers=0`, BF16, LoRA r=16, alpha=32, dropout=0.05, targets `q_proj` and `v_proj`, lr 1e-4, weight decay 0.01, warmup 0.05, 2 epochs, max length 128, seed 42. `expandable_segments` is not supported on this Windows GPU.

Candidate A: 436 rows, 26 steps, 41.47 s, train loss 3.439.

| epoch | loss | grad_norm | learning_rate |
|---:|---:|---:|---:|
| 0.73 | 3.806 | 2.460 | 6.67e-5 |
| 1.51 | 3.391 | 1.777 | 2.50e-5 |

Candidate B: 732 rows, 44 steps, 72.06 s, train loss 4.004.

| epoch | loss | grad_norm | learning_rate |
|---:|---:|---:|---:|
| 0.44 | 4.652 | 1.911 | 8.29e-5 |
| 0.87 | 4.144 | 2.127 | 5.85e-5 |
| 1.35 | 3.933 | 2.228 | 3.41e-5 |
| 1.79 | 3.573 | 1.887 | 9.76e-6 |

Full machine log: `train_log_20260927T205343Z.txt`. Scores: `report_20260927T205343Z.json`.

## Blind holdout (16 meanings)

| System | Devanagari chrF | Roman via phone path | Roman fed directly | Mean latency |
|---|---:|---:|---:|---|
| Production base | 0.6653 | 0.6468 | 0.0469 | 201–327 ms |
| A | 0.6848 | 0.6576 | 0.0469 | 228–308 ms |
| B | 0.6761 | 0.6576 | 0.0559 | 224–302 ms |

A minus base: Devanagari +0.0195, phone-path Roman +0.0108, direct Roman +0.0000.

## Gold

`ne_en_deva` n=133, `ne_en_roman` n=134.

| System | Devanagari | Roman via phone path | Roman fed directly | Mean latency |
|---|---:|---:|---:|---|
| Production base | 0.7093 | 0.4881 | 0.0796 | 118–162 ms |
| A | 0.7125 | 0.4950 | 0.0774 | 135–175 ms |
| B | 0.7137 | 0.5006 | 0.0884 | 133–179 ms |

A minus base: Devanagari +0.0032, phone-path Roman +0.0069, direct Roman −0.0022.

Both A and B clear the 0.55 / 0.40 floors on Devanagari and phone-path Roman. Direct Roman stays near 0.08, the same failure mode as the earlier sheet-50 Roman number.

## Earlier sheet-50 run (do not mix the decode)

`benchmarks/results/sheet50_delta_20260927T160332Z.json` used beam 5 on both directions and made gold worse. Overall chrF 0.5111 → 0.4118 (delta −0.0993). NE→EN Devanagari 0.7011 → 0.5793. NE→EN Roman 0.0759 → 0.0595. That Roman figure is direct Roman, which matches this run’s direct-Roman column, not the phone path.

## What the numbers leave open

The finished NE→EN adapter is a small lift on a few hundred rows and two epochs. Loss was still above 3. Direct Roman training did not make Roman input usable. The phone still loads INT8 ONNX and cannot attach this LoRA until there is an export that does not use `merge_and_unload`.
