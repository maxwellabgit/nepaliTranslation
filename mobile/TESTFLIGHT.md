# Internal TestFlight checklist

App version **1.7.0** (`mobile/app.json`). This build is a final internal device test of placement and review. It does not prove ad revenue, rewarded credits, or that review rewards are finished.

Do not use the `production` EAS profile, and do not run `npm run build:ios` for this test. That script builds `production`. Do not resubmit rejected build 18 (`6a089eeb-7f6e-47c9-8665-8a235f006eed`, git `c8eb079c6782`). Apple rejected it during processing (ITMS-90683). Purpose strings are now in `mobile/app.json`.

## Profiles

| Profile | Ads | Use |
| --- | --- | --- |
| `testflight` | Google demo units. Banner unit is the anchored adaptive demo `ca-app-pub-3940256099942544/2435281174`. No revenue. | See banners and the automatic full-screen ad. |
| `testflight-ssv` | Owner AdMob units on registered test devices. | Prove one signed rewarded callback grants 2 credits once. |
| `production` | Live IDs only. | App Store. Not this test. |

Both TestFlight profiles use the EAS `preview` environment. `EXPO_PUBLIC_ADS_ENV=test` is set on `testflight`. `testflight-ssv` sets `test-ssv`.

## Build under test

Fill this in for the binary you actually install. Leave a row blank until you have the value.

| Field | Value |
| --- | --- |
| Git commit | `7dd41f7` plus the uncommitted gauge, source-only review, adaptive banner, and camera-retake fixes that were in the working tree at upload |
| EAS build ID | `fe1cbf33-19ee-4142-aff0-5868a4b82fec` |
| EAS profile | `testflight` |
| App Store build number | 20 (version 1.7.0) |
| EAS submission | `910466aa-990e-471c-a943-32918e72ebeb` finished uploading at 2026-09-28T21:17:51Z |
| Apple processing | uploaded; not confirmed accepted yet |
| Installed on | |

Build and submit that exact binary:

```bash
cd mobile
npx eas build --platform ios --profile testflight
npx eas submit --platform ios --profile testflight --id <EAS_BUILD_ID>
```

EAS submission uploads the binary. It does not publish the app to the App Store. Install only after App Store Connect shows that this build ID finished processing.

## Flags for this cohort

Re-read staging `app_config` before the build. Force-quit the app after a flag change.

| Flag | Intended for the demo-ad test | Actual value at test time |
| --- | --- | --- |
| `network_ads_enabled` | on, to show banners | |
| `automatic_interstitial_enabled` | on, to allow the full-screen ad | |
| `rewarded_ads_enabled` | off, until a `testflight-ssv` callback is proven | |
| `paywall_enabled` | off | |
| `public_review_enabled` | off, unless this session is the review test | |
| `public_review_release_approved` | off, unless this session is the review test | |
| contribution, telemetry, deletion processing | off | |

## What the ad UI does

The credits gauge reads the same foreground-time total as interstitial eligibility. It counts only while the app is open. At 15:00 it shows **Ad ready**. The full-screen ad appears only after that, and only at Translate Send, a saved Camera capture, or a finished Learn activity. AdMob owns presentation and dismissal. There is no skippable video when the gauge hits zero.

**Ads off** means the automatic interstitial is suppressed: the flag is off, the phone is offline, ad consent blocks the request, or subscription / earned ad-free time is active. A confirmed impression resets the gauge to 15:00.

Banners appear on idle Translate (empty field, keyboard down) and on Learn. The test banner is anchored adaptive.

## Device results

Check a box only on the installed build above.

- [ ] Apple processing accepted this EAS build ID
- [ ] Airplane mode: typed translation, Camera, and Learn still work
- [ ] Idle Translate banner shows a Test Ad
- [ ] Learn banner shows a Test Ad
- [ ] Gauge reaches Ad ready only after 15 minutes in the foreground
- [ ] Full-screen ad appears at a safe point after Ad ready, then the gauge returns to 15:00
- [ ] Gauge shows Ads off when the interstitial flag is off, or while ad-free / subscribed
- [ ] Source-only review hides “Our translation”; a typed answer and “Same meaning” submit as edits; skip and report submit as skip and report
- [ ] Same build on iPhone and iPad

Rewarded credits, live AdMob revenue, and a passing English-to-Nepali model certificate are outside this checklist.
