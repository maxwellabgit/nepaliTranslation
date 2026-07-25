# TestFlight

**Current target:** **1.6.2** — EN→NE IndicTrans2 only in the IPA (~half prior model size) + Meaning Review.

## Models

- Bundled: `it2_en_indic` INT8 only
- NE→EN: phrasebook / lexicon (no second ONNX graph)

## Meaning Review → local train

1. Settings → Advanced → Meaning Review  
2. Export JSON  
3. On this PC:

```powershell
python training/route_corrections.py export.json
python training/local_auto_train.py --daemon
```

Training starts automatically after **100 edited** meanings are routed.

## Build

```powershell
cd mobile
npx eas build --platform ios --profile production
```

(Skip auto-submit unless you ask for TestFlight.)
