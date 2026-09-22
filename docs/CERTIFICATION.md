# Certification checklist (accessibility, privacy, quality)

Source-side items can be marked **source-proven**. Device-only items stay open until a physical iPhone/iPad pass is recorded in [`DEVICE_PROOF.md`](./DEVICE_PROOF.md). Product boundary: [`.governance/INTENT.md`](../.governance/INTENT.md). Contract freeze: [`.governance/V1_G0_DECISIONS.md`](../.governance/V1_G0_DECISIONS.md).

**Honesty (2026-09-22):** Tip `43f9bc6` is **not** an external TestFlight release candidate. Soft model-cert CI with missing ONNX weights is **not** four-class certification. TestFlight test ads and sandbox IAP are **not** revenue proof.

## Quality honesty

| Item | Status | Notes |
|------|--------|--------|
| “Translation may be imperfect” + path to **Mark incorrect** | **Source-proven** | Settings quality copy; Mark incorrect on Translate results |
| Informal Nepali register = तिमी (not तँ) in UI catalogs | **Source-proven** | `mobile/src/i18n/ne.ts` + i18n unit tests |
| Full bilingual UI (EN / नेपाली) via persisted selector | **Partial** | Settings selector + catalogs; device a11y = G4/G6 |
| Exact bundled models pass four-class gold ship eval | **Blocked / G4** | Thresholds in [`MODEL_CERT.md`](./MODEL_CERT.md). Soft CI green ≠ certified while weights missing |
| Gold eval / device translation quality claim | Device / human | Never claim ship quality from Windows alone |

## Privacy & contribution

| Item | Status | Notes |
|------|--------|--------|
| Camera OCR on-device; temporary files deleted after retake/exit/processed | **Source-proven** | Guests never upload |
| No photo-library permission for Camera path | **Source-proven** | |
| Guest / non-consenting content stays local | **Source-proven** | |
| Startup consent gate (T&C + Privacy + 18+) blocks product surfaces | **Not built / G2** | Owner directive 2026-09-22 |
| Contribution requires Sign in with Apple + startup 18+ consent | **Partial / G2** | Withdrawal + full purge incomplete per audit |
| Post-consent **photo + raw speech** upload + offline retry, account-linked | **Not built / G2** | Speech in V1 scope per owner directive; `contribution_speech_enabled` off until proof |
| Public review: **global 10/day** at 5:00 PM NY rotation; all corpora eligible | **Not built / G1** | Current consensus tasks ≠ requested pool |
| Indefinite retention until withdrawal/deletion; **30-day** purge of all linked data | **Partial / G2** | Every row must carry `user_id` |
| Raw text/audio/photos never in third-party analytics | **Source-proven (scrubber)** | Live sink human-gated |
| Login never required for Translate, Camera, Learn, History, Settings | **Source-proven** | Purchase/restore/contribution **do** require login (G0) |
| Optional services fail soft | **Source-proven** | |
| Privacy / Terms / support / deletion / app-ads.txt live | **Blocked — hosting / G5** | |
| App Store privacy labels match runtime | **Source worksheet** | Connect form + legal = human |

## Monetization & ads (policy certification)

| Item | Status | Notes |
|------|--------|--------|
| Subscription US **$0.99/month** removes every ad | **Partial / G3** | Sign-in required before purchase/restore; UUID identity |
| Banners only idle Translate + Learn landing | **Source-proven** | Device AdMob = human |
| Automatic interstitial: **15 min since last successful impression**, ≤3/NY day, safe idle, SDK dismiss | **Broken/incomplete / G3** | Audit: `load().catch` vs void API; cumulative timer; weak opportunities |
| Rewarded video opt-in; **15** ad-free minutes after SSV | **Broken/incomplete / G3** | Same SDK event mismatch |
| Ads offline → house / no network SDK | **Source-proven** | |
| TestFlight uses test ad units; live revenue needs prod IDs + app-ads.txt | Policy / G3+G5 | |
| ATT / IDFA not used this release | Policy | Contextual / non-personalized default |

## Accessibility

| Item | Status | Notes |
|------|--------|--------|
| Meaningful accessibility labels on primary controls | **Source-proven** | Tabs, Speak, Pass, Mark incorrect, Camera overlays, etc. |
| VoiceOver full walkthrough | **Device-only / G4–G6** | Fill [`DEVICE_PROOF.md`](./DEVICE_PROOF.md) |
| Dynamic Type / larger text | **Partial** | Full scale = device matrix |
| Contrast (light + dark) | **Partial** | Device a11y = G4/G6 |
| Reduce Motion | Device | Gate product motion when added |
| Offline core usable | **Source-proven** | |

## Permissions (purpose strings)

| Permission | Status | Notes |
|------------|--------|-------|
| Microphone | Source string ready | Must not claim speech-media upload in V1 |
| Speech recognition | Source string ready | On-device recognition (F1) |
| Camera | Source string ready + in-UI note | Consented photo upload ≠ “always on-device only” |

## Offline

| Item | Status | Notes |
|------|--------|-------|
| Typing translate offline | **Source-proven** (phrase/lexicon + integration); neural weights device | |
| Speech unavailable → typed path remains | Required | Fail closed on missing on-device locales |
| Camera OCR offline | Source path + fixture; **native OCR device-only** | |
| Learn alphabet offline | **Source-proven** | |

## Admin console

| Item | Status | Notes |
|------|--------|-------|
| Dashboard / media / alerts / deletions / flags / dataset staging | **Source-proven (foundation)** | |
| Public-review adjudication + pool runway | **Missing / G1** | |
| Live allowlist ops + Playwright signed-in triage | Human-gated | |

## Remaining human gates

See [`RELEASE_RUNBOOK.md`](./RELEASE_RUNBOOK.md) go/no-go and [`plans/active/v1-testflight-finalization.md`](../plans/active/v1-testflight-finalization.md).
