# NepTranslate — offline iOS (Expo + EAS)

On-device English ↔ Nepali translation. All speech recognition and translation run on the iPhone after models are installed. No PC server, tunnel, or cloud inference in the product path.

Develop on Windows. Cloud-build with EAS. Install via TestFlight after Apple Developer enrollment.

---

## Architecture

```
iPhone (Expo)
  ├─ STT: whisper.rn (ggml Whisper) or on-device speech APIs
  └─ MT:  ONNX Runtime — IndicTrans2-class en↔ne
```

Models ship bundled under `mobile/assets/models/` or download on first launch. See [`../docs/OFFLINE_IOS.md`](../docs/OFFLINE_IOS.md).

---

## Modes

| Mode | Use |
|------|-----|
| **Translate** | Type, speak, and pass the phone on one screen. **Pass** flips the language. Last 5 turns can **Retry**. Formal / script live in the options sheet. |
| **Camera** | Point at Nepali or English text. Recognition and translation stay on the phone. Photos are deleted after retake, exit, or processing. |
| **Learn** | Offline Nepali alphabet. No account required. |

### Toggles (light switches)

- **Formal** — switch **ON** = formal Nepali (`तपाईं`); off = informal (`तिमी`).
- **देवनागरी** — switch **ON** = Devanagari; off = Roman Nepali. Both live in the Translate options sheet.

---

## One-time setup

1. **Apple Developer Program** — [developer.apple.com/programs](https://developer.apple.com/programs/) (~$99/year).
2. **Expo account** — [expo.dev/signup](https://expo.dev/signup).
3. On your Windows PC:

```powershell
cd c:\Users\maxwe\.cursor\nepaliTranslation\mobile
npm install
npx eas-cli login
npx eas build:configure
```

`eas build:configure` links the EAS project and writes `extra.eas.projectId` into `app.json`. Let EAS **manage credentials** when prompted.

4. In [App Store Connect](https://appstoreconnect.apple.com): app **NepTranslate**, bundle id `com.neptranslate.app`. The numeric App ID is in `eas.json` → `submit.production.ios.ascAppId`.

---

## Build & install (TestFlight)

```powershell
cd c:\Users\maxwe\.cursor\nepaliTranslation\mobile

npx eas build --platform ios --profile production
npx eas submit --platform ios --latest
```

On iPhone: install **TestFlight**, accept the invite, install NepTranslate. See [`TESTFLIGHT.md`](TESTFLIGHT.md) for version / processing notes.

**First launch:** allow microphone (and speech recognition if prompted). If models download on first launch, wait for the download to finish before speaking.

---

## Local JS smoke (optional)

```powershell
npx expo start
```

Expo Go is useful for layout checks only. Mic + on-device inference need a **device build** (TestFlight or development client).

---

## Bundle id

`com.neptranslate.app` — must match App Store Connect and Apple Developer identifiers.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Models not ready | Wait for first-launch download; confirm `assets/models/` bundle in release build |
| Translate quality regression | Re-run gold bench — [`../benchmarks/gold/`](../benchmarks/gold/) |
| EAS credentials errors | `npx eas credentials` → regenerate iOS certs |
| Mic denied | iOS Settings → NepTranslate → Microphone |
| Build without Apple account | Device IPA requires Apple Developer enrollment |
