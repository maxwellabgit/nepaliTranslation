# TestFlight

Offline iOS builds ship through Expo EAS → App Store Connect → TestFlight. No server URL or tunnel configuration is required.

**Current release:** app version **1.4.2** — Auto + Conversation, Formal/देवनागरी switches, sentence-aware translate, Gold Review (▣, password `1234`).

## Build & submit

```powershell
cd mobile
npx eas build --platform ios --profile production --auto-submit
```

Or stepwise:

```powershell
npx eas build --platform ios --profile production
npx eas submit --platform ios --latest
```

Apple processing usually takes **5–15 minutes** after submit succeeds.

## On your iPhone

1. Open **TestFlight** → pull to refresh **NepTranslate**
2. Tap **Update** (or install if new)
3. Confirm **v1.4.2** on the Auto screen footer (`v1.4.2 (N) · offline`)

If stuck on an old build: delete the app → reinstall from TestFlight.

App Store Connect: https://appstoreconnect.apple.com/apps/6792574384/testflight/ios

## Privacy strings

iOS rejects IPAs missing required `Info.plist` usage descriptions (e.g. microphone, speech recognition, photo library). Those live in `app.json` → `expo.ios.infoPlist`. If submit reports **ITMS-90683**, add the missing key there and rebuild (e.g. `NSPhotoLibraryUsageDescription` even when only an SDK references Photos APIs).

## What to verify

- **Normal** — type and speak; EN↔NE auto-detect
- **Conversation** — continuous speak; sentences translate as you finish them; Pass flushes remainder
- **Formal / Informal** — Nepali register when English is the source
- **Devanagari / Roman** — script toggle on Nepali output
- **Gold Review** — ▣ top-right → password `1234` → Correct / edit / Export
- **Offline** — airplane mode; phrasebook translate still works
