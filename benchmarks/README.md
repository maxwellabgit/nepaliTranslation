# Benchmarks — English ↔ Nepali

## Primary: gold standard (`gold/`)

Curated eval — **100 samples per class** (400 total):

| Class | What it tests |
|-------|----------------|
| `en_ne_formal` | English → Nepali (formal) |
| `en_ne_informal` | English → Nepali (informal) |
| `ne_en_deva` | Nepali Devanagari → English |
| `ne_en_roman` | Romanized Nepali → English |

```powershell
python benchmarks/fill_gold.py
python benchmarks/run_gold_bench.py
python benchmarks/score_phrasebook_gold.py
```

**Visualizations:** open [`results/gold_viz/index.html`](results/gold_viz/index.html)  
PNGs: `coverage.png`, `length_hists.png`, `phrasebook_chrf.png`

Curation guide: [`gold/README.md`](gold/README.md). Summary JSON: `results/gold_summary.json`.

**Ship gate:** on-device MT must meet or beat the frozen gold baseline before promoting a model build.

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
