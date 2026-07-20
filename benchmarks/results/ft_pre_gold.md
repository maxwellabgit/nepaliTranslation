# Fine-tune gold evaluation (`pre`)

Generated: 2026-07-20T16:53:49.383706+00:00
Base: `facebook/nllb-200-distilled-600M`
Adapter: `None`

## Overall chrF

| System | Overall chrF | seconds |
|--------|-------------:|--------:|
| `phrasebook` | 10.3% | 0.0 |
| `nllb_base` | 48.1% | 62.9 |

## Per-class chrF

| Class | phrasebook | nllb_base |
|-------|-------:|-------:|
| en_ne_formal | 14.2% | 64.6% |
| en_ne_informal | 13.2% | 58.2% |
| ne_en_deva | 13.5% | 61.0% |
| ne_en_roman | 0.0% | 8.0% |
