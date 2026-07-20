# Premium gold sources & adversarial prune (2026-07-20)

## HF auth
- Token loaded from `benchmarks/.env` via `python benchmarks/hf_login.py`
- Authenticated as **maxwellbHF**
- `benchmarks/.env` is gitignored

## Gold-standard sources (S/A) — verified access

| Source | Access | License | Role |
|--------|--------|---------|------|
| **FLORES+ `npi_Deva`** | Gated terms accepted; 997 EN↔NE dev pairs cached in `benchmarks/data/flores_plus_npi_eng_dev.jsonl` | CC-BY-SA (eval integrity constraints) | Eval seed only — rewrite for conversational register; do not train on FLORES+ |
| **IN22-Conv** | Access OK; 100 conversational turns slimmed to `benchmarks/data/in22_conv_npi_slim.jsonl` | CC-BY-4.0 | Best conversational seed — rewrite formal/informal; never dump verbatim into product gold |
| **BPCC `daily` / `npi_Deva`** | Gated (AI4Bharat); download in progress / retry | CC-BY-4.0 | HQ train bulk after dedupe vs gold |
| Peace Corps Spoken Nepali | Public domain (US gov) | PD | Informal phrase eval |
| Global Voices Lingua NE | CC BY 3.0 | Article pairs | Selective seed |
| Wikivoyage Nepali phrasebook | CC BY-SA 4.0 | Travel phrases | Informal seed |
| CLE Urdu–NE–EN / Law Commission slices | Verify per file | Human-aligned | Formal eval / HQ train |
| DOL/Verité labor curriculum EN↔NE | Likely CC BY | Professional translation | Formal/health-adjacent |

### Reject (look gold, are not)
- Samanantar / ParaCrawl / ashokpoudel 3.56M / sharad461 synthetic 1.6M
- OPUS-100 mined, WikiMatrix, OpenSubtitles noise
- NLLB **weights** for commercial ship (CC-BY-NC); mined NLLB bitext ≠ gold
- `कार्ड चल्नुहुन्छ`, `म ठिक छु` ↔ *I am fine*, slash multi-gloss refs

## Composer fleets

### Research fleet (additional sources)
Prioritized: Law Commission official EN, CLE PTB slice, DOL labor curriculum, EDCD PEN manuals, Peace Corps, Global Voices, Smriti TMX, Wikivoyage, Constitution 2015 bilingual.

### Adversarial fleet (kill / accept)
- Target prune **~4–5% of premium** (~88 → kill 4–5 hard rot items)
- Hard kills: dual-sense `चिसो`, `कार्ड चल्नुहुन्छ`, premium `बाटो बिराएँ` / `I lost my way` cluster dups
- Rewrites: *What would you like to eat?* → `के खान चाहनुहुन्छ?`; room with a view → `भ्यू भएको कोठा`; roman keep `ke`
- Fleet-2 accepts: health center, ATM, old city, coughing, blood test, card **काम गर्छ**, ward, `paisa sakiyo`, delicious, don't leave me
- Rejects: dizzy calque, credit-card dup, keep-the-change dup, cooked-food sense error

## Premium set mutation (this run)
Script: `python benchmarks/prune_expand_premium.py` (+ 2 restores to stay ≤5%)

| Step | Premium count |
|------|----------------|
| Before | 88 |
| Hard kills (chiso×2, card calque, formal lost-way dup) | −4 (**4.5%**) |
| Borderline removed then restored (informal lost-way, roman `bato biraye`) | net 0 |
| Rewrites | 5 refs fixed in place |
| Split chiso replacements | +4 |
| Fleet-2 unique adds | +~49 |
| **After** | **~135–137** |

Killed sources: `के तपाईं कार्ड चल्नुहुन्छ?`, dual-sense `मलाई चिसो लाग्यो` (+ roman), premium formal `I lost my way.`

## HQ train set plan (500–2k) — without contaminating gold
1. Hold out entire `benchmarks/gold/` (sources+refs) from training forever
2. Seed train from: BPCC-H daily/wiki human, IN22-Gen (not Conv if Conv used for gold seeds — prefer disjoint docs), Peace Corps + Wikivoyage rewritten, Smriti UI strings
3. Dedup by normalized EN+NE against gold
4. Register tag: `तपाईं`/`तिमी` verb agreement filters
5. Roman train = romanize Devanagari with chat rules; do not mine YouTube roman
6. Cap 500–2k high-audit pairs before student distillation from IndicTrans2-1B (MIT, gated)

## Manual step remaining
If BPCC/IN22 gate prompts appear in browser for other configs, accept once at:
- https://huggingface.co/datasets/ai4bharat/BPCC
- https://huggingface.co/datasets/ai4bharat/IN22-Conv
