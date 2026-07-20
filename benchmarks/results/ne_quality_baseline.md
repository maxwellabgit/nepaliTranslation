# Nepali quality benchmark (baseline)

- When: `2026-07-19T23:42:19.467495+00:00`
- Device: `cuda`
- Suite: FLORES-101 + OPUS-100 test (filtered Devanagari)
- Counts: `{'flores101_dev': 997, 'opus100_test': 1121}`
- Eval n: **2118**

| Direction | chrF++ | BLEU | n | ms/sent |
|-----------|--------|------|---|---------|
| ne-en | **63.94** | 41.6 | 2118 | 257.9 |
| en-ne | **53.43** | 34.64 | 2118 | 286.6 |

## Honorific (EN→NE register)
- Formal marker rate: **1.0**
- Informal marker rate: **1.0**
- n=15

## Per-domain chrF++

### ne-en
- `flores`: chrF++ **65.94**, BLEU 42.97 (n=997)
- `opus100_test`: chrF++ **56.11**, BLEU 33.05 (n=1121)

### en-ne
- `flores`: chrF++ **55.09**, BLEU 36.93 (n=997)
- `opus100_test`: chrF++ **47.84**, BLEU 25.9 (n=1121)
