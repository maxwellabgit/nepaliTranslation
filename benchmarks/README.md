# Benchmarks — English ↔ Nepali

## Primary: gold standard (`gold/`)

Curated eval. Original scaffold **100/class**; live frozen sizes **137 / 139 / 133 / 134** (543 total). Manifests and `results/gold_freeze.json` are authoritative.

Two gates (do not mix):

- **Phrasebook floor** — v1.4.0 phrase table on the original 400, frozen 2026-07-20 (`results/gold_baseline.md` section 1).
- **IT2 ship-gate freeze** — SHA256 + counts of the live holdout (`results/gold_freeze.json`). On-device IndicTrans2 is judged here.

```powershell
python benchmarks/check_gold_integrity.py
```

| Class | What it tests |
|-------|----------------|
| `en_ne_formal` | English → Nepali (formal) |
| `en_ne_informal` | English → Nepali (informal) |
| `ne_en_deva` | Nepali Devanagari → English |
| `ne_en_roman` | Romanized Nepali → English |

```powershell
python benchmarks/check_gold_integrity.py
python benchmarks/run_gold_bench.py
python benchmarks/score_phrasebook_gold.py
```

Do **not** run `fill_gold.py` against live gold. It is the original 100-row scaffold writer and will refuse unless you pass `--force-overwrite-scaffold`.

**Visualizations:** open [`results/gold_viz/index.html`](results/gold_viz/index.html)  
PNGs: `coverage.png`, `length_hists.png`, `phrasebook_chrf.png`

Curation guide: [`gold/README.md`](gold/README.md). Summary JSON: `results/gold_summary.json`.

**Ship gate:** on-device MT is judged against the **IT2 freeze** in `results/gold_freeze.json` (integrity: `check_gold_integrity.py`). The v1.4.0 phrasebook floor in `results/gold_baseline.md` is a different, historical number.

## Secondary / legacy corpus suites

Larger automated suites for training regression — not the sole ship gate.

### Comprehensive quality bench

```powershell
$env:HF_HUB_DISABLE_XET = "1"
python benchmarks/build_ne_quality_bench.py
python benchmarks/run_ne_quality_bench.py
```

FLORES-101 + OPUS-100 test (filtered Devanagari), plus honorific register probe. Results: `benchmarks/results/ne_quality_baseline.json`.

### Legacy FLORES quick slice

```powershell
python benchmarks/run_mt_bench.py --n 50 --directions ne-en,en-ne
```

Frozen baseline: `benchmarks/results/flores_baseline.json`. Useful for fast direction checks during model work; superseded by `gold/` for product decisions.
