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
In-app Meaning Review (password 1234)
  English read-only · edit NE formal/informal + Roman
  Accept all | Skip (flags founder queue)
        ↓ export JSON
training/route_corrections.py
  train_meaning → meaning_bank.jsonl
  founder_queue → founder_review_queue.jsonl
        ↓ when ≥100 edited
training/local_auto_train.py  (this machine overnight)
  build_meaning_bank → finetune_it2_meanings (en-ne) → eval
```

On-device ship: **both EN→NE and NE→EN INT8**. Chat-Roman is normalized to Devanagari before NE→EN. Phrase overlay from the meaning bank covers in-domain lines exactly. See `training/DATA.md`.


## Scripts

```powershell
python training/build_meaning_bank.py
python training/finetune_it2_meanings.py --directions en-ne,ne-en --epochs 3
```

Roman house style: [`ANNOTATION_GUIDE_ROMAN.md`](ANNOTATION_GUIDE_ROMAN.md)
