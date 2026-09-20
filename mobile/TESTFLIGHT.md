# TestFlight

**Current target:** **1.6.2** — EN→NE IndicTrans2 only in the IPA (~half prior model size) + Meaning Review.

## Models

- Bundled: `it2_en_indic` INT8 only
- NE→EN: phrasebook / lexicon (no second ONNX graph)

## Corrections (product path)

Mark incorrect / To training open the in-app correction sheet and save to the offline outbox.
Upload requires Sign in with Apple + consent. The old PC review-sync tunnel is retired for product builds.

Meaning Review under Settings → Advanced is a local founder tool (confirm dialog, no password, no automatic upload).

## Build

```powershell
cd mobile
npx eas build --platform ios --profile production
```

(Skip auto-submit unless you ask for TestFlight.)
