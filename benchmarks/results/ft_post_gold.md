# Fine-tune gold evaluation (`post`)

Generated: 2026-07-20T17:08:05.764040+00:00
Base: `facebook/nllb-200-distilled-600M`
Adapter: `C:\Users\maxwe\.cursor\nepaliTranslation\training\artifacts\nllb600m_en_ne_lora\adapter`

## Overall chrF

| System | Overall chrF | seconds |
|--------|-------------:|--------:|
| `nllb_ft` | 40.8% | 138.6 |

## Per-class chrF

| Class | nllb_ft |
|-------|-------:|
| en_ne_formal | 39.1% |
| en_ne_informal | 49.8% |
| ne_en_deva | 67.1% |
| ne_en_roman | 7.0% |
