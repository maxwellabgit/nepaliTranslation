# Offline MT benchmarks (Nepali ↔ English, Hindi)

Autonomous evaluation harness for the local IndicTrans2 models used by the offline app.

## Primary metrics

| Metric | Library | Notes |
|--------|---------|--------|
| **chrF++** | sacrebleu (`chrF2++`) | Primary quality signal for Indic scripts (character n-grams + word bigrams). |
| **BLEU** | sacrebleu (`corpus_bleu`, 13a tokenizer for EN; `flores200` / none for Devanagari) | Secondary; report alongside chrF++. |

Scores are corpus-level over the evaluated slice (default `n=50`).

## Primary split: FLORES eng_Latn ↔ npi_Deva (and hin_Deva)

| Split | Languages | Role |
|-------|-----------|------|
| **FLORES-200 / FLORES+** | `eng_Latn` ↔ `npi_Deva`, `eng_Latn` ↔ `hin_Deva` | Primary official-style eval |
| Cached **FLORES-101** sample | same three columns in `data/flores_sample.json` | Offline / gated-HF fallback |

`run_mt_bench.py` tries HuggingFace (`openlanguagedata/flores_plus`, then `facebook/flores`) first. If gated or unavailable, it loads `benchmarks/data/flores_sample.json` (FLORES-101 `dev`: eng / npi / hin).

## Secondary: IN22-Conv

If `ai4bharat/IN22-Conv` is reachable (HF auth), the harness also scores conversational pairs and records them under `secondary` in the results JSON. Skipped silently when gated.

## Models under test

| Direction | Path |
|-----------|------|
| Indic → EN | `experiments/models/it2_indic_en_merged` |
| EN → Indic | `experiments/models/it2_en_indic_merged` |

Loading reuses `core.translation.indictrans2.TranslationManager` (IndicProcessor + `AutoModelForSeq2SeqLM`).

## Honorific probe

`honorific_probe.json` — hand-written English sentences tagged `formal` / `informal` for future तपाईं vs तिमी (and related) register evaluation. Not scored by the FLORES baseline run.

## Quick start

```powershell
$env:HF_HUB_DISABLE_XET = "1"
pip install -r benchmarks/requirements.txt
python benchmarks/run_mt_bench.py --n 50
```

Results: `benchmarks/results/flores_baseline.json`.

### Flags

| Flag | Default | Meaning |
|------|---------|---------|
| `--n` | `50` | Sentences per direction |
| `--directions` | `ne-en,en-ne,hi-en,en-hi` | Comma-separated pairs |
| `--skip-secondary` | off | Skip IN22-Conv attempt |
| `--device` | auto | `cuda` / `cpu` |
