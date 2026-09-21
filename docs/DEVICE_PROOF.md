# Device proof (physical iPhone)

**Status: BLOCKED — needs physical iPhone + Apple developer session**

Do not invent EAS build results, CocoaPods success, or device metrics from Windows. This document is the human runbook only.

## What Windows already proved

| Gate | Evidence |
|------|----------|
| Typecheck / lint | `cd mobile && npx tsc --noEmit`, `npm run lint` |
| Unit + integration | `npm run test:unit`, `npm run test:integration` (guest Translate / Camera / Learn; offline house ads; Mark incorrect) |
| Translation quality scripts | `npm run verify:translate` |
| Full CI entry | `npm run verify:ci` (lexicon, lint, typecheck, unit, integration, verify:translate, Expo Doctor, coverage ratchet, web export) |
| Playwright product scenarios | `cd testing-ground && npm run test:scenarios` (10/12 automated on Expo web + TG recorded runtime; live mic and live camera+ML Kit skipped) |

Not proven on Windows: `pod install`, ML Kit native resolve, EAS IPA, TestFlight install, Maestro on device, mic/camera interrupt, memory under real inference.

## Exact commands (human)

From a machine with Expo account + Apple Developer access (`mobile/`):

```bash
cd mobile
npx eas login
npx eas build --platform ios --profile development
# Install the development build on a physical iPhone (QR / internal distribution).
```

Internal TestFlight (after a store-oriented build):

```bash
cd mobile
npx eas build --platform ios --profile preview   # or production
npx eas submit --platform ios --latest
# App Store Connect → TestFlight → Internal Testing → install on device
```

Maestro on device (app already installed; Maestro CLI on PATH):

```bash
cd mobile
maestro test .maestro/smoke_tabs.yaml
maestro test .maestro/translate-empty.yaml
maestro test .maestro/camera-tab.yaml
maestro test .maestro/learn-alphabet.yaml
```

## Checklist (fill on device — leave unchecked until proven)

- [ ] CocoaPods resolves `GoogleMLKit/TextRecognition` + `TextRecognitionDevanagari` beside Google Mobile Ads (`pod install` / EAS build log)
- [ ] Bundled ONNX / Whisper model hashes match release notes (or documented first-launch fetch)
- [ ] Mic purpose string shown: `NSMicrophoneUsageDescription` / speech recognition string match `app.json`
- [ ] Camera purpose string shown: on-device OCR; photos deleted after retake / leave / finish
- [ ] Background / interrupt: leave app mid-listen and mid-TTS; audio hard-stops; no stuck “listening”
- [ ] Memory: Translate + Camera OCR + Learn TTS under real device pressure without jetsam during a short session
- [ ] Airplane mode: Translate typing + Camera OCR path still usable; ads stay house / none (no network AdMob)
- [ ] Maestro smoke tabs green on the installed build

## Related

- Accessibility / privacy source checklist: [`CERTIFICATION.md`](./CERTIFICATION.md)
- Store / TestFlight sequence: [`RELEASE_RUNBOOK.md`](./RELEASE_RUNBOOK.md)
- Offline stack notes: [`OFFLINE_IOS.md`](./OFFLINE_IOS.md)
