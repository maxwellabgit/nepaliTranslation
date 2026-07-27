# TestFlight

**Current target:** **1.6.2** — EN→NE IndicTrans2 only in the IPA (~half prior model size) + Meaning Review.

## Models

- Bundled: `it2_en_indic` INT8 only
- NE→EN: phrasebook / lexicon (no second ONNX graph)

## Meaning Review → local train

1. Settings → Advanced → Meaning Review (password `1234`)
2. Accept / Skip — batches sync to this PC when the review sync server + tunnel are running
3. On this PC:

```powershell
# Keep running while testers review
$env:REVIEW_SYNC_SECRET = "neptranslate-sync-test-2026"
python training/review_sync_server.py --host 0.0.0.0 --port 8765

# Overnight train when ≥100 edited meanings are routed
python training/local_auto_train.py --daemon
```

See `training/REVIEW_SYNC.md`. Training starts automatically after **100 edited** meanings are routed.

## Build

```powershell
cd mobile
npx eas build --platform ios --profile production
```

(Skip auto-submit unless you ask for TestFlight.)
