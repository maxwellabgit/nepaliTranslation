# TestFlight

Offline iOS builds ship through Expo EAS → App Store Connect → TestFlight.

**Current target:** **1.6.0** — On-device IndicTrans2 (INT8 ONNX). First launch downloads ~545MB model once; phrasebook remains fallback until ready / if download fails.

**What this binary runs today:**
- **MT:** IndicTrans2 on-device when model is ready; traveler phrasebook + lexicon fallback
- **STT:** Apple speech recognition (may need network)

## Build & submit

```powershell
cd mobile
npx eas build --platform ios --profile production --auto-submit
```

## On your iPhone

1. TestFlight → refresh **NepTranslate** → Update  
2. Confirm Settings → About: `v1.6.0` · model ready (after first download)  
3. First open needs network for the one-time model download; afterward MT works offline

App Store Connect: https://appstoreconnect.apple.com/apps/6792574384/testflight/ios

## What to verify

- Header shows **Preparing / Downloading** then **On-device translation**
- Free English → Nepali (not just phrasebook lines) returns Devanagari
- Formal / Informal / Roman chips still work
- Airplane mode after download: typing still translates
- Conversation Pass uses the same engine
- Gold Review: flat sample queue

## Model notes

- Repos: `hari31416/indictrans2-*-dist-200M-ONNX-int8`
- Cached under app documents `models/it2_*`
- Optional local seed: `python scripts/download_it2_onnx.py` (gitignored assets)
