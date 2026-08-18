# Gold baselines — two different numbers

Do **not** treat these as one gate.

## 1. Phrasebook floor (historical, v1.4.0, frozen 2026-07-20)

Status: **complete on the original 100/class scaffold** · 400/400 samples

This is the in-app phrasebook score on gold **as it existed at v1.4.0** (`n=100` per class). It is **not** the IndicTrans2 ship gate and it is **not** a score on the current 543-row holdout.

| Class | n | Phrasebook chrF | Norm exact | Hit rate |
|-------|--:|----------------:|-----------:|---------:|
| `en_ne_formal` | 100 | 19.2% | 19.0% | 20% |
| `en_ne_informal` | 100 | 18.1% | 16.0% | 20% |
| `ne_en_deva` | 100 | 17.8% | 16.0% | 21% |
| `ne_en_roman` | 100 | 0.0% | 0.0% | 0% |

Visualizations: [`gold_viz/index.html`](gold_viz/index.html)

Snapshot JSON from that run: `gold_summary.json` / `gold_baseline.json` (also n=100 / 400). Leave them as the phrasebook-era record.

## 2. IT2 ship-gate freeze (live holdout)

On-device IndicTrans2 must be evaluated with `eval_it2_gold.py` against the files hashed in [`gold_freeze.json`](gold_freeze.json). Integrity (no GPU): `python benchmarks/check_gold_integrity.py`.

The holdout freeze was refreshed **2026-08-18T07:48:20Z** so SHA256 + counts match live gold (543 rows), including the two informal छस्→छौ stick fixes. The 2026-07-20 freeze was 537; commit `81cdbb4` (2026-07-25) had added **+6** love/like Kathmandu rows that were previously unfrozen:

| Class | Freeze 2026-07-20 | Freeze 2026-08-18 | Delta | New ids (2026-07-25) |
|-------|------------------:|------------------:|------:|---------|
| `en_ne_formal` | 135 | 137 | +2 | `en_ne_formal-136`, `en_ne_formal-137` |
| `en_ne_informal` | 137 | 139 | +2 | `en_ne_informal-138`, `en_ne_informal-139` |
| `ne_en_deva` | 132 | 133 | +1 | `ne_en_deva-133` |
| `ne_en_roman` | 133 | 134 | +1 | `ne_en_roman-134` |
| **Total** | **537** | **543** | **+6** | |

Premium counts did not change (35/37/32/33). Schema `n_target_base` remains 100; schema `n_target` matches the frozen class size.

A new IT2 run beating the **phrasebook floor** is a different sentence from “this build beats the last IT2 freeze.”
