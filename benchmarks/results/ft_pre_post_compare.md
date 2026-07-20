# Pre / post fine-tune gold results

Generated: 2026-07-20T17:16:52Z

## Selected model

- **Base:** `facebook/nllb-200-distilled-600M` (best ungated Nepali MT available without AI4Bharat gate)
- **License:** CC-BY-NC-4.0 — research / quality ceiling only (do **not** redistribute in the commercial app)
- **Preferred commercial ship:** IndicTrans2 dist-200M (MIT) after accepting HF gates, or mT5-base (Apache-2.0)

## chrF on private gold holdout

| System | Overall | EN→NE formal | EN→NE informal | NE→EN Deva | NE→EN Roman |
|--------|--------:|-------------:|---------------:|-----------:|------------:|
| `phrasebook` (current app) | 10.3% | 14.2% | 13.2% | 13.5% | 0.0% |
| `nllb_base` (pre-FT) | **48.1%** | **64.6%** | **58.2%** | 61.0% | **8.0%** |
| `nllb_ft` v1 + formality tags | 40.8% | 39.1% | 49.8% | 67.1% | 7.0% |
| `nllb_ft` v1 no tags | 45.6% | 58.6% | 49.8% | 67.1% | 7.0% |
| `nllb_ft_v2` short-conv LoRA | 46.5% | 59.6% | 49.9% | **69.5%** | 7.0% |

## Pre vs post summary

| Direction | Pre (`nllb_base`) | Best post | Delta |
|-----------|------------------:|----------:|------:|
| EN→NE formal | 64.6% | 59.6% (v2) | −5.0 |
| EN→NE informal | 58.2% | 49.9% (v2) | −8.3 |
| NE→EN Deva | 61.0% | **69.5%** (v2) | **+8.5** |
| NE→EN Roman | 8.0% | 7.0% | −1.0 |
| Overall | **48.1%** | 46.5% (v2) | −1.6 |

**Takeaway:** LoRA on OPUS-heavy data helped **NE→EN** (+8.5 chrF) but slightly hurt conversational **EN→NE**. Keep **base NLLB** for EN→NE and **v2 adapter** for NE→EN until a cleaner conversational FT (or IndicTrans2) beats base on both.

Artifacts: `training/artifacts/nllb600m_en_ne_lora/` (v1), `.../nllb600m_en_ne_lora_v2/` (v2).
