# Premium gold model evaluation

Generated: 2026-07-20T16:26:18.637873+00:00

Gold sizes: {'en_ne_formal': {'n': 124, 'premium': 24}, 'en_ne_informal': {'n': 124, 'premium': 24}, 'ne_en_deva': {'n': 120, 'premium': 20}, 'ne_en_roman': {'n': 120, 'premium': 20}}

## Overall chrF (weighted by class n)

| System | Overall chrF | n |
|--------|-------------:|--:|
| `phrasebook` | 11.3% | 488 |
| `google_gtx` | 53.1% | 488 |

## Per-class chrF

| Class | phrasebook | google_gtx |
|-------|-------:|-------:|
| `en_ne_formal` | 15.5% | 68.8% |
| `en_ne_informal` | 14.6% | 61.3% |
| `ne_en_deva` | 14.9% | 74.3% |
| `ne_en_roman` | 0.0% | 7.0% |

## Register markers (EN→NE)

| System | Formal तपाईं rate | Informal OK rate |
|--------|------------------:|-----------------:|
| `phrasebook` | 20% | 100% |
| `google_gtx` | 6% | 94% |

## Notes

- `phrasebook`: current on-device ship floor (bundled lexicon).
- `marian_hplt`: open CC-BY HPLT Marian v2.0 (if loaded).
- `google_gtx`: unofficial web endpoint — **demo baseline only**, not for production.
- IndicTrans2-1B / cloud LLM oracles need HF gated access + API keys (see analysis report).
- Premium tier items stress **word choice** and **honorifics**; chrF alone understates register errors.
