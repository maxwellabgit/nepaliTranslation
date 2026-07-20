# TestFlight

Offline iOS builds ship through Expo EAS → App Store Connect → TestFlight. No server URL or tunnel configuration is required.

**Current release:** app version **1.4.0** (Normal + Conversation modes, offline-only product).

## Build & submit

```powershell
cd mobile
npx eas build --platform ios --profile production
npx eas submit --platform ios --latest
```

Apple processing usually takes **5–15 minutes** after submit succeeds.

## On your iPhone

1. Open **TestFlight** → pull to refresh **NepTranslate**
2. Tap **Update** (or install if new)
3. Confirm the build version in the app status line

If stuck on an old build: delete the app → reinstall from TestFlight.

App Store Connect: https://appstoreconnect.apple.com/apps/6792574384/testflight/ios

## Privacy strings

iOS rejects IPAs missing required `Info.plist` usage descriptions (e.g. microphone, speech recognition). Those live in `app.json` → `expo.ios.infoPlist`. If submit reports **ITMS 90683**, add the missing key there and rebuild.

## What to verify

- **Normal** — type and speak; EN↔NE auto-detect
- **Conversation** — Handoff + Speak; large latest translation
- **Formal / Informal** — Nepali register when English is the source
- **Offline** — airplane mode after models are on device; translate still works
