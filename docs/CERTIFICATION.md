# Certification checklist (accessibility, privacy, quality)

Source-side items can be marked **source-proven**. Device-only items stay open until a physical iPhone/iPad pass is recorded in [`DEVICE_PROOF.md`](./DEVICE_PROOF.md). Product boundary: [`.governance/INTENT.md`](../.governance/INTENT.md).

## Quality honesty

| Item | Status | Notes |
|------|--------|--------|
| “Translation may be imperfect” + path to **Mark incorrect** | **Source-proven** | Settings quality copy; Mark incorrect on Translate results |
| Informal Nepali register = तिमी (not तँ) in UI catalogs | **Source-proven** | `mobile/src/i18n/ne.ts` + i18n unit tests |
| Full bilingual UI (EN / नेपाली) via persisted selector | **Partial / F2 chrome wired** | Settings selector + catalogued Translate/Camera/tabs/Learn/contribution sheets; sentence a11y via catalog; device a11y (VoiceOver / Dynamic Type) = F10 |
| Exact bundled models pass four-class gold ship eval | **Partial / F9** | Thresholds pre-declared in [`MODEL_CERT.md`](./MODEL_CERT.md) + `benchmarks/ship_thresholds.json`. `python benchmarks/certify_ship_artifacts.py` validates schema/pins; **BLOCKER** until ONNX weights on eval host |
| Gold eval / device translation quality claim | Device / human | Never claim ship quality from Windows alone |

## Privacy & contribution

| Item | Status | Notes |
|------|--------|--------|
| Camera OCR on-device; temporary files deleted after retake/exit/processed | **Source-proven** | Guests never upload |
| No photo-library permission for Camera path | **Source-proven** | |
| Guest / non-consenting content stays local | **Source-proven** | Outbox today is explicit; F3 adds post-consent auto media upload |
| Contribution requires Sign in with Apple + **18+** + versioned consent covering media | **Partial / source-proven** | F3 - version `2026-09-21.media`; legal review before live collection |
| Post-consent speech/photo auto-upload + offline retry | **Partial / source-proven** | F3 - photo Camera path + media outbox; speech enqueue API ready; STT does not yet produce a recording URI (blocker) |
| Indefinite retention until withdrawal/deletion; **30-day** purge | **Partial / source-proven** | F4 — request + purge job RPCs; flag-gated delete-account; device proof = human |
| Raw text/audio/photos never in third-party analytics | **Source-proven (scrubber)** | F1 diagnostics + F8 telemetry scrubber/tests; `telemetry_enabled` default off. Live sink still human-gated. |
| Login never required for Translate, Camera, Learn, History, Settings | **Source-proven** | |
| Optional services fail soft | **Source-proven** | |
| Privacy / Terms / support / deletion / app-ads.txt live | **Blocked — hosting** | Settings links + honest “not live yet” when `EXPO_PUBLIC_*` URLs empty. Source `docs/app-ads.txt` not crawlable until public host. |
| App Store privacy labels match runtime | **Source worksheet** | [`APP_STORE_PRIVACY_LABELS.md`](./APP_STORE_PRIVACY_LABELS.md) — Connect form + legal review = human |

## Monetization & ads (policy certification)

| Item | Status | Notes |
|------|--------|--------|
| Subscription US **$0.99/month** removes every ad | **Partial / source-proven** | F6 — PurchaseService + paywall + webhook; cancelled entitled until expiry; StoreKit/TestFlight matrix = human gate |
| Banners only idle Translate + Learn landing | **Source-proven** | F5 — placements + policy tests; device AdMob = human gate |
| Automatic interstitial: 15 foreground min, ≤3/NY day, safe idle only, SDK dismiss | **Partial / source-proven** | F5 policy + flag (default off); device + external-beta go/no-go still required |
| Rewarded video opt-in; **15** ad-free minutes after SSV | **Partial / source-proven** | F4 schedule + SSV tests at 15 min; device AdMob proof = human gate |
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

## Admin console (F7)

| Item | Status | Notes |
|------|--------|--------|
| Dashboard / review / alerts / deletions / flags / dataset staging | **Source-proven** | `admin/` SPA + `admin-api` router; Vitest + Deno + pgTAP |
| Server allowlist via `private.admin_users`; revoked loses next request | **Source-proven** | `service_assert_admin`; pgTAP revoked/unknown |
| Non-admin 403; no service key in browser; media preview audited | **Source-proven** | Anon + JWT only; `admin_media_preview` → `audit_log` |
| Live allowlist ops + Playwright signed-in triage | Human-gated | Insert/revoke operators in Supabase; Playwright not automated in F7 |

## Remaining human gates

- Exact IT2 ONNX four-class gold eval vs [`MODEL_CERT.md`](./MODEL_CERT.md) floors (weights on GPU/eval host)
- AdMob EAS on physical iPhone/iPad (banner, rewarded, interstitial) with UMP
- Sign in with Apple (sign-in / revoke / cancel / delete-account / 30-day deletion)
- Legal Privacy / Terms / support / app-ads.txt **live crawlable URLs** (source templates + Settings blockers only in F8)
- App Store Connect privacy answers entered from [`APP_STORE_PRIVACY_LABELS.md`](./APP_STORE_PRIVACY_LABELS.md)
- RevenueCat / StoreKit $0.99 sandbox + TestFlight matrix
- Bilingual Learn alphabet + UI sign-off
- Automatic interstitial deliberate go/no-go after external beta stability
- Admin allowlist operators in production Supabase + signed-in Playwright triage
- Telemetry remote enable only after legal review (`telemetry_enabled`)
- Expo-transitive dependency advisories per [`DEPENDENCY_TRIAGE.md`](./DEPENDENCY_TRIAGE.md) on F10 freeze
- Maestro native stubs (`.maestro/*`) on physical iPhone/iPad — see `mobile/.maestro/README.md`