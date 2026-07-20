# NepTranslate controlled architecture (v1)

## Product surface (four modes, one MT)

```
Text or speech
     ↓
Language detection / offline ASR
     ↓
Input normalization (incl. noisy Roman → Devanagari)
     ↓
One EN↔NE translation family (IndicTrans2 dist-200M MIT)
  control tokens (product): <en><ne><formal> | <en><ne><informal> | <ne><en>
  model prefixes (IndicTrans2-safe): <formal> | <informal> on EN→NE; direction via checkpoint
     ↓
Canonical Devanagari Nepali
     ↓
Optional everyday Roman renderer (deterministic house style)
     ↓
Displayed output
```

**Do not** train four independent MT models (formal/informal × Devanagari/Roman). That fragments data and lets modes drift.

Informal = friendly **तिमी** Nepali (not तँ) for v1.

## Meaning-centric data

```json
{
  "meaning_id": "travel_00031",
  "english": "Please wait here.",
  "ne_formal": "कृपया यहाँ पर्खनुहोस्।",
  "ne_informal": "यहाँ पर्ख न।",
  "roman_formal": "kripya yaha parkhanuhos.",
  "roman_informal": "yaha parkha na."
}
```

- Bank: `training/data/meaning_bank.jsonl`
- Expanded FT examples (≤10k): `train_meanings_*.jsonl`
- User review / future in-app training curation should edit **meanings**, not four divergent strings.

## Model

| Item | Choice |
|------|--------|
| Base | IndicTrans2 en-indic + indic-en dist-200M (**MIT**) |
| Why two weights | IndicTrans2 is directional; still **one controlled system**, not four register models |
| Window | max positions 256; FT truncate 96; **sentence-level** |
| Fine-tune | LoRA adapters; **never** `merge_and_unload` |
| Deploy | INT8 first (ONNX / Core ML / Android); INT4 only if gold register/names survive |

## User data improvement

```
In-app Gold Review (holdout sentences, password 1234)
        ↓ export JSON
benchmarks/apply_app_reviews.py  →  frozen gold stay frozen
        ↓
Meaning units (preferred long-term):
  edit english / ne_formal / ne_informal only
  roman_* = everyday_roman(ne_*)   ← never hand-edit separately
        ↓
training/build_meaning_bank.py  (≤10k expanded examples, surface caps)
        ↓
training/finetune_it2_meanings.py  → LoRA adapters (no merge_and_unload)
        ↓
ONNX/Core ML INT8 + identical tokenize/decode tests
```

In-app review should prefer **meaning units**, not four divergent translation strings.
Surface caps keep OPUS/`core_grammar` from drowning travel/health/honorifics.  


## Scripts

```powershell
python training/build_meaning_bank.py
python training/finetune_it2_meanings.py --directions en-ne,ne-en --epochs 3
```

Roman house style: [`ANNOTATION_GUIDE_ROMAN.md`](ANNOTATION_GUIDE_ROMAN.md)
