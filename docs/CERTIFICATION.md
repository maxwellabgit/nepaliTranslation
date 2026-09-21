# Certification checklist (accessibility, privacy, quality)

Source-side items can be marked **source-proven**. Device-only items stay open until a physical iPhone/iPad pass is recorded in [`DEVICE_PROOF.md`](./DEVICE_PROOF.md). Product boundary: [`.governance/INTENT.md`](../.governance/INTENT.md).

## Quality honesty

| Item | Status | Notes |
|------|--------|--------|
| “Translation may be imperfect” + path to **Mark incorrect** | **Source-proven** | Settings quality copy; Mark incorrect on Translate results |
| Informal Nepali register = तिमी (not तँ) in UI catalogs | **Source-proven** | `mobile/src/i18n/ne.ts` + i18n unit tests |
| Full bilingual UI (EN / नेपाली) via persisted selector | **Partial / F2 chrome wired** | Settings selector + catalogued Translate/Camera/tabs/Learn/contribution sheets; sentence a11y via catalog; device a11y (VoiceOver / Dynamic Type) = F10 |
| Exact bundled models pass four-class gold ship eval | **Not done** | F9 — thresholds pre-declared; never edit gold |
| Gold eval / device translation quality claim | Device / human | Never claim ship quality from Windows alone |

## Privacy & contribution

| Item | Status | Notes |
|------|--------|--------|
| Camera OCR on-device; temporary files deleted after retake/exit/processed | **Source-proven** | Guests never upload |
| No photo-library permission for Camera path | **Source-proven** | |
| Guest / non-consenting content stays local | **Source-proven** | Outbox today is explicit; F3 adds post-consent auto media upload |
| Contribution requires Sign in with Apple + **18+** + versioned consent covering media | **Not done** | F3 — age UI copy is 18+; versioned media consent + auto-upload remain F3 |
| Post-consent speech/photo auto-upload + offline retry | **Not done** | F3 |
| Indefinite retention until withdrawal/deletion; **30-day** purge | **Not done** | F4 |
| Raw text/audio/photos never in third-party analytics | Partial | F1 remove raw console logs; F8 telemetry scrubber |
| Login never required for Translate, Camera, Learn, History, Settings | **Source-proven** | |
| Optional services fail soft | **Source-proven** | |

## Monetization & ads (policy certification)

| Item | Status | Notes |
|------|--------|--------|
| Subscription US **$0.99/month** removes every ad | **Not done** | F6 — contract updated in F0; runtime still stub/$0.49 era |
| Banners only idle Translate + Learn landing | **Not done** | F5 — tighten placements |
| Automatic interstitial: 15 foreground min, ≤3/NY day, safe idle only, SDK dismiss | **Not done** | F5; flag off until device + external-beta go/no-go |
| Rewarded video opt-in; **15** ad-free minutes after SSV | Partial source | Adapter exists; grant length + schedule still old (10 min / UTC) until F4/F5 |
| Ads offline → house / no network SDK | **Source-proven** | |
| ATT / IDFA not used this release | Policy | Contextual / non-personalized default |

## Accessibility

| Item | Status | Notes |
|------|--------|--------|
| Meaningful accessibility labels on primary controls | **Source-proven** | Tabs, Speak, Pass, Mark incorrect, Camera overlays, etc. |
| VoiceOver full walkthrough | **Device-only** | iPhone + iPad |
| Dynamic Type / larger text | **Partial / F2** | Min 44pt targets + labels; full Dynamic Type scale remains device-gated |
| Contrast (light + dark) | **Partial (F2)** | Scheme-aware StatusBar + useTheme on shell/Translate/Camera/Learn alphabet/Settings/contribution sheets; house/rewarded ads partially themed; full device a11y = F10 |
| Reduce Motion | Device | Gate product motion when added |
| Offline core usable | **Source-proven** | |

## Permissions (purpose strings)

| Permission | Status | Notes |
|------------|--------|--------|
| Microphone | Source string ready | Device: confirm dialog text |
| Speech recognition | Source string ready | Must enforce on-device recognition (F1) |
| Camera | Source string ready + in-UI note | Device: confirm dialog text |

## Offline

| Item | Status | Notes |
|------|--------|--------|
| Typing translate offline | **Source-proven** (phrase/lexicon + integration); neural weights device | |
| Speech unavailable → typed path remains | Required F1 | Fail closed on missing on-device locales |
| Camera OCR offline | Source path + fixture; **native OCR device-only** | |
| Learn alphabet offline | **Source-proven** | |

## Remaining human gates

- AdMob EAS on physical iPhone/iPad (banner, rewarded, interstitial) with UMP
- Sign in with Apple (sign-in / revoke / cancel / delete-account / 30-day deletion)
- Legal Privacy / Terms / support / app-ads.txt live URLs
- RevenueCat / StoreKit $0.99 sandbox + TestFlight matrix
- Bilingual Learn alphabet + UI sign-off
- Automatic interstitial deliberate go/no-go after external beta stability
