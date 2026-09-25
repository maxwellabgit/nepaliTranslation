# Device proof (physical iPhone + iPad)

**Status: BLOCKED — needs physical iPhone/iPad + Apple developer session**

Do not invent EAS build results, CocoaPods success, or device metrics from Windows. This document is the human runbook only. Product boundary: [`.governance/INTENT.md`](../.governance/INTENT.md). Contract freeze: [`.governance/V1_G0_DECISIONS.md`](../.governance/V1_G0_DECISIONS.md). Model floors: [`MODEL_CERT.md`](./MODEL_CERT.md). Store sequence: [`RELEASE_RUNBOOK.md`](./RELEASE_RUNBOOK.md).

**R0/R5/R9 rule:** leave every matrix / checklist box unchecked until a human fills it on a real device with the **same** TestFlight (or internal) build number recorded below. Source-only CI is not device proof. An ad-enabled diagnostic TestFlight may use test ads and staging flags after consent is checked. Public V1 still requires a four-class model PASS.

## Build under test (fill on device)

| Field | Value |
|-------|--------|
| EAS / TestFlight build number | _pending_ |
| App version (`CFBundleShortVersionString`) | _pending_ |
| Git SHA baked into the build | _pending_ |
| IT2 manifest | _pending — paste every `en-indic` and `indic-en` file name, size, and SHA-256 from `mobile/src/mt/onnx/it2-release-manifest.json`, plus both repos and revisions_ |
| Gate | _pending — `diagnostic-testflight` (owner-authorized, model failure disclosed) or `public` (four-class PASS required)_ |
| Feature-flag snapshot (all optional services) | _pending — paste remote `app_config` row or note “all off”_ |
| Tester / date | _pending_ |

## What Windows already proved

| Gate | Evidence |
|------|----------|
| Typecheck / lint | `cd mobile && npx tsc --noEmit`, `npm run lint` |
| Unit + integration | `npm run test:unit`, `npm run test:integration` |
| Translation quality scripts | `npm run verify:translate` |
| Full CI entry | `npm run verify:ci` |
| Playwright product scenarios | `cd testing-ground && npm run test:scenarios` (base 10/12 + F9 surfaces on Expo web + TG; live mic and live camera+ML Kit skipped) |
| Ship cert (schema/pins) | `python benchmarks/certify_ship_artifacts.py` — soft BLOCKER without ONNX weights |

Not proven on Windows: `pod install`, ML Kit native resolve, EAS IPA, TestFlight install, Maestro on device, mic/camera interrupt, memory under real inference, StoreKit, live AdMob interstitial, media upload against production-like storage, VoiceOver / Dynamic Type on device.

## Exact commands (human)

Both TestFlight profiles use the EAS `preview` environment for **staging** Supabase credentials. From a machine with Expo and Apple Developer access, first build with Google's demo units to see banner/interstitial placements:

```bash
cd mobile
npx eas-cli login
npm ci
npm run verify:ci
npx eas-cli build --platform ios --profile testflight
npx eas-cli submit --platform ios --profile testflight --latest
```

For a signed reward test, configure the owner's AdMob iOS app, three units, signed SSV callback, and registered physical test-device IDs as described in `TESTFLIGHT_WITH_ADS.md`. Then use the owner units on **those test devices**:

```bash
cd mobile
npx eas-cli build --platform ios --profile testflight-ssv
npx eas-cli submit --platform ios --profile testflight-ssv --latest
```

Select that build in App Store Connect → TestFlight → Internal Testing and install it on the iPhone and iPad. Record each build number and git SHA separately. Google demo units cannot establish a signed reward, and neither build produces ad revenue.

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

Record OS version + device model next to each box when checked.

- [ ] Oldest supported iPhone / iOS combination — model: ____ OS: ____
- [ ] Current standard iPhone — model: ____ OS: ____
- [ ] Current large-screen iPhone — model: ____ OS: ____
- [ ] 11-inch iPad — model: ____ OS: ____
- [ ] 13-inch iPad — model: ____ OS: ____
- [ ] Latest public iOS/iPadOS — device: ____
- [ ] Oldest supported OS on at least one phone and one tablet

**Same-build rule:** every checked row above must use the build number in “Build under test”. If a new build ships, clear checks and re-run.

## Checklist (fill on device — leave unchecked until proven)

### Native resolve + models

- [ ] CocoaPods resolves ML Kit OCR (Latin + Devanagari), Google Mobile Ads, RevenueCat, ONNX Runtime, Apple Sign-In, speech recognition together
- [ ] Bundled ONNX / speech model **SHA-256** match release manifest (F1/F9 pins)
- [ ] Cold/warm latency, peak RAM, install size, Camera memory, thermal, long-session notes recorded (attach notes or link)

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
- [ ] Post-consent **Camera photo** upload when flagged; guest/non-consent uploads nothing; raw speech-media upload **deferred** (not a V1 device-proof item)
- [ ] AdMob banner (idle Translate + Learn only), rewarded (2 credits / 30 minutes after verified SSV), interstitial (policy + SDK dismiss) — interstitial only if deliberately enabled
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
