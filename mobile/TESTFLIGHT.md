# TestFlight

**Current target:** **1.6.1** — On-device IndicTrans2 **bundled in the IPA** (no first-launch model download).

## Why 1.6.0 looked stuck

1.6.0 tried to download ~545MB from Hugging Face at runtime. That path soft-failed (network / HF / ORT), so the UI stayed on “preparing model” and only the phrasebook worked. Models were also excluded from the EAS upload via `.easignore`.

## What 1.6.1 does

- `eas-build-post-install` downloads INT8 graphs **during the cloud build**
- `plugins/withIt2Models` packs them into the iOS app resources / Android assets
- App loads from the install bundle immediately (phrasebook still fallback)

## Build & submit

```powershell
cd mobile
npx eas build --platform ios --profile production --auto-submit
```

IPA will be large (~600MB+). First TestFlight install may take a while over Wi‑Fi.

## On your iPhone

1. TestFlight → Update NepTranslate **1.6.1**
2. Settings → About should show `model ready` shortly after open (no long download)
3. Try free text e.g. “Tomorrow we can clean the apartment”

App Store Connect: https://appstoreconnect.apple.com/apps/6792574384/testflight/ios
