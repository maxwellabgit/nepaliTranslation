# Certification checklist (accessibility, privacy, quality)

Source-side items can be marked **source-proven**. Device-only items stay open until a physical iPhone pass is recorded in [`DEVICE_PROOF.md`](./DEVICE_PROOF.md).

## Quality honesty

| Item | Status | Notes |
|------|--------|--------|
| “Translation may be imperfect” + path to **Mark incorrect** | **Source-proven** | Settings → Quality (`settings.qualityBody`); Mark incorrect on Translate results |
| Informal Nepali register = तिमी (not तँ) in UI catalogs | **Source-proven** | `mobile/src/i18n/ne.ts` + i18n unit tests |
| Gold eval / device translation quality claim | Device / human | Never claim ship quality from Windows alone |

## Privacy

| Item | Status | Notes |
|------|--------|--------|
| Camera OCR on-device; captures temporary; not saved to Photos | **Source-proven** | `NSCameraUsageDescription`; Camera permission copy; `deleteCapture` on retake/exit/processed |
| No photo-library permission for Camera path | **Source-proven** | No `NSPhotoLibraryUsageDescription` for this feature |
| Core translate / history never auto-uploaded | **Source-proven** | Contribution outbox is explicit Mark incorrect / To training only |
| Login never required for Translate, Camera, Learn, History, Settings | **Source-proven** | Integration: guest cold launch + offline panes + inscription without sign-in |
| Optional services fail soft | **Source-proven** | Auth banner leaves Translate usable; offline ads → house / blocked network |

## Accessibility

| Item | Status | Notes |
|------|--------|--------|
| Meaningful accessibility labels on primary controls | **Source-proven** | Tabs, Speak, Pass, Mark incorrect, Settings close, Camera overlays, etc. (unit/integration) |
| VoiceOver full walkthrough | **Device-only** | Physical iPhone |
| Dynamic Type / larger text | **Device-only** | Most screens use fixed StyleSheet sizes today |
| Contrast (light + dark) | Partial source | Theme tokens exist; many screens still bind light `colors` — visual QA on device |
| Reduce Motion | N/A this pass | No product motion added that needs `AccessibilityInfo` gating; skip inventing animation |
| Offline core usable | **Source-proven** | Integration offline launch; Settings/Contributions offline banners |

## Permissions (purpose strings)

| Permission | Status | Notes |
|------------|--------|--------|
| Microphone | Source string ready | Device: confirm system dialog text |
| Speech recognition | Source string ready | Device: confirm system dialog text |
| Camera | Source string ready + in-UI note | Device: confirm system dialog text |

## Offline

| Item | Status | Notes |
|------|--------|--------|
| Typing translate offline | **Source-proven** (phrase/lexicon + integration); neural weights device | |
| Camera OCR offline | Source path + fixture; **native OCR device-only** | |
| Learn alphabet offline | **Source-proven** | |
| Ads offline → house / no network SDK | **Source-proven** | `decideAdPresentation` + ad middleware + AdSlot tests |

## Remaining human gates (optional services)

Documented for slice 10 honesty — not closed by this checklist:

- AdMob EAS development build on physical iPhone (flags stay off until proven)
- Sign in with Apple on device (sign-in / revoke / cancel / delete-account)
- Legal consent copy beyond draft version
- RevenueCat / StoreKit subscription (beta program Slice 09+; product deferred — not claimed here)
- Bilingual Learn alphabet romanization sign-off
