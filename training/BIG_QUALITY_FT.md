# Big quality IndicTrans2 fine-tune (in progress)

## Job

```powershell
python training/prepare_big_quality_ft.py
python training/finetune_it2_big.py --directions en-ne,ne-en --max-train 60000 --epochs 3 --lora-r 32
```

- **Data:** `training/data/train_big_quality.jsonl` (~80k pool; FT uses 60k)
- **Val:** 1200
- **Roman attach:** ~8k for NE→EN
- **Outputs:** `training/artifacts/it2_big_quality_{en_ne,ne_en}_lora/`
- **Logs:** `training/artifacts/it2_big_quality_train.log`

## Mix (commercial-safe, gold blocked)

| Source | Role |
|--------|------|
| Short OPUS conversational | Volume |
| Meaning-bank formal/informal (2×) | Register control |
| OPUS register + expand | तपाईं / तिमी |
| Global Voices / law / user seeds | Domain |
| Roman house-style views | Noisy NE→EN |

Excludes NLLB CC-BY-NC bulk. Never trains on `benchmarks/gold/`.

## After finish

```powershell
python benchmarks/eval_it2_gold.py --systems it2_base,it2_meanings,it2_ft --tag it2_big_post
```

(Add `it2_big` system to eval if not present — adapters under `it2_big_quality_*_lora/adapter`.)
