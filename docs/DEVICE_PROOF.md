# Device proof (physical iPhone + iPad)

**Status: BLOCKED — needs physical iPhone/iPad + Apple developer session**

Do not invent EAS build results, CocoaPods success, or device metrics from Windows. This document is the human runbook only. Product boundary: [`.governance/INTENT.md`](../.governance/INTENT.md).

## What Windows already proved

| Gate | Evidence |
|------|----------|
| Typecheck / lint | `cd mobile && npx tsc --noEmit`, `npm run lint` |
| Unit + integration | `npm run test:unit`, `npm run test:integration` |
| Translation quality scripts | `npm run verify:translate` |
| Full CI entry | `npm run verify:ci` |
| Playwright product scenarios | `cd testing-ground && npm run test:scenarios` (base 10/12 + F9 surfaces on Expo web + TG; live mic and live camera+ML Kit skipped) |
| Ship cert (schema/pins) | `python benchmarks/certify_ship_artifacts.py` — soft BLOCKER without ONNX weights |

Not proven on Windows: `pod install`, ML Kit native resolve, EAS IPA, TestFlight install, Maestro on device, mic/camera interrupt, memory under real inference, StoreKit, live AdMob interstitial, media upload against production-like storage.

## Exact commands (human)

From a machine with Expo account + Apple Developer access (`mobile/`):

```bash
cd mobile
npx eas login
npx eas build --platform ios --profile development
# Install the development build on physical iPhone and iPad (QR / internal distribution).
```

Internal TestFlight (after a store-oriented build):

```bash
cd mobile
npx eas build --platform ios --profile preview   # or production
npx eas submit --platform ios --latest
# App Store Connect → TestFlight → Internal Testing → install on devices
```

Maestro on device (app already installed; Maestro CLI on PATH):

```bash
cd mobile
maestro test .maestro/smoke_tabs.yaml
maestro test .maestro/translate-empty.yaml
maestro test .maestro/camera-tab.yaml
maestro test .maestro/learn-alphabet.yaml
maestro test .maestro/ui-lang-toggle.yaml
maestro test .maestro/settings-consent.yaml
maestro test .maestro/learn-rewards.yaml
maestro test .maestro/deletion-messaging.yaml
maestro test .maestro/dark-mode-smoke.yaml
# See .maestro/README.md for honest native blockers (AdMob, StoreKit, Apple Sign-In, ML Kit).
```

## Device matrix (fill on device — leave unchecked until proven)

- [ ] Oldest supported iPhone / iOS combination
- [ ] Current standard iPhone
- [ ] Current large-screen iPhone
- [ ] 11-inch iPad
- [ ] 13-inch iPad
- [ ] Latest public iOS/iPadOS
- [ ] Oldest supported OS on at least one phone and one tablet

## Checklist (fill on device — leave unchecked until proven)

### Native resolve + models

- [ ] CocoaPods resolves ML Kit OCR (Latin + Devanagari), Google Mobile Ads, RevenueCat, ONNX Runtime, Apple Sign-In, speech recognition together
- [ ] Bundled ONNX / speech model **SHA-256** match release manifest (F1/F9 pins)
- [ ] Cold/warm latency, peak RAM, install size, Camera memory, thermal, long-session notes recorded

### Offline core

- [ ] Mic / speech purpose strings match `app.json`; on-device recognition enforced; unavailable locales fail closed with typed path still usable
- [ ] Camera purpose string: on-device OCR; temporary files deleted after retake / leave / finish
- [ ] Background / interrupt: leave app mid-listen and mid-TTS; audio hard-stops; no stuck “listening”
- [ ] Airplane mode: Translate typing + Camera OCR + Learn usable; ads stay house / none
- [ ] Maestro smoke tabs green on the installed build (phone + iPad)

### Accessibility / UI

- [ ] VoiceOver, Voice Control, Dynamic Type, contrast, dark mode, Reduce Motion
- [ ] English and नेपाली UI switch; Learn alphabet bilingual human sign-off
- [ ] iPad layouts: no clipped primary controls; Camera capture/result portrait OK

### Optional services (when flags enabled in internal testing)

- [ ] Sign in with Apple: sign-in / cancel / revoke / delete-account; deletion request shows 30-day deadline
- [ ] Post-consent speech + Camera upload; guest/non-consent uploads nothing
- [ ] AdMob banner (idle Translate + Learn only), rewarded (15 min after SSV), interstitial (policy + SDK dismiss) — interstitial only if deliberately enabled
- [ ] RevenueCat / StoreKit: purchase, cancel, restore, expire, billing retry, offline launch, second-device restore
- [ ] Subscription suppresses every ad format immediately

## Related

- Accessibility / privacy source checklist: [`CERTIFICATION.md`](./CERTIFICATION.md)
- Store / TestFlight sequence: [`RELEASE_RUNBOOK.md`](./RELEASE_RUNBOOK.md)
- Offline stack notes: [`OFFLINE_IOS.md`](./OFFLINE_IOS.md)
- App Store privacy worksheet: [`APP_STORE_PRIVACY_LABELS.md`](./APP_STORE_PRIVACY_LABELS.md)
- Dependency triage: [`DEPENDENCY_TRIAGE.md`](./DEPENDENCY_TRIAGE.md)

## F8 store / legal blockers (not inventable from Windows)

- [ ] Privacy Policy / Terms / support / deletion HTTPS pages hosted and wired via `EXPO_PUBLIC_*`
- [ ] Crawlable `app-ads.txt` at developer domain root (source template: [`app-ads.txt`](./app-ads.txt))
- [ ] App Store Connect privacy answers entered from worksheet (no ATT/IDFA claim)
- [ ] Telemetry remains flag-off until legal review; no raw content in crash/analytics payloads on device
