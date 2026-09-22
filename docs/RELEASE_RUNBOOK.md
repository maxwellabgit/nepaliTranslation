# Release runbook (TestFlight → App Store)

**Status: BLOCKED — founder Apple Connect / legal / bilingual sign-off / F1–F10 completion**

Do not claim App Store submission from this document or from Windows CI. Use this as the human sequence after V1 slices F0–F9 source gates and device proof ([`DEVICE_PROOF.md`](./DEVICE_PROOF.md)). Product boundary: [`.governance/INTENT.md`](../.governance/INTENT.md).

## Product freeze (must match INTENT)

- Ad-free subscription: **US $0.99/month** (StoreKit is authoritative for displayed price)
- Ads: banners idle Translate + Learn only; automatic interstitial 15 foreground minutes / ≤3 per America/New_York day / safe idle only / SDK dismiss / remotely disableable
- Rewarded video: **15** ad-free minutes after SSV
- Rewards: 1 credit = 5 minutes; >20 original words = 2 credits; close **5:00 PM America/New_York**; no clawback
- Contributions: 18+ versioned consent; post-consent media upload; 30-day deletion
- Platforms: iPhone **and** iPad; UI English **and** नेपाली

## Sequence

1. **Internal TestFlight** — Exact build with all optional feature flags **off**, then enable one subsystem at a time (auth → text contributions → media → rewards → banners/rewarded → paywall). Smoke: Translate, Camera, Learn, History, Settings; airplane mode; Mark incorrect; iPhone + iPad.
2. **External TestFlight cohort** — 25–50 bilingual EN/NE reviewers. Enable contribution collection only after final legal approval. Enable **automatic interstitial only** after banner/rewarded stability and an explicit go/no-go (utility-app risk).
3. **Stability gate** — Seven consecutive days with no open P0/P1, deletion deadline breaches, privacy leaks, crash regressions, or reward ledger inconsistencies.
4. **Phased public** — Freeze version/build, model hashes, migrations, flags, privacy labels, screenshots, descriptions, review notes, support contact, rollback instructions. Submit the exact tested build. Prefer phased release if Connect supports it.

## Monitoring

- Crash / hang reports in App Store Connect / Xcode Organizer
- Support inbox and inappropriate-ad reporting (Settings)
- Feature flags (independent):
  - `contribution_text_enabled` / `contribution_speech_enabled` / `contribution_photos_enabled`
  - `network_ads_enabled` / `rewarded_ads_enabled` / `automatic_interstitial_enabled`
  - `paywall_enabled` / `telemetry_enabled` / `deletion_processing_enabled`
- Review retention, ad complaints, subscription conversion, translation/camera failure rates before interstitial go-live
- Do not treat gold-benchmark edits as a release lever

## Rollback

- Pause external TestFlight / phased release in App Store Connect
- Ship a hotfix build via EAS → submit → promote previous build if needed
- Remote flags: disable ads (including interstitial), contributions, media upload, rewards, or paywall **without** breaking offline Translate / Camera / Learn
- Never roll back by editing `benchmarks/gold/` references

## Support

- In-app: Settings quality note (Mark incorrect); Contributions & rewards; report inappropriate ad; subscription manage / restore
- In-app legal section: Privacy / Terms / support / deletion info via `EXPO_PUBLIC_*` HTTPS URLs; honest “not live yet” when unset (F8)
- Out-of-band: Privacy Policy, Terms, support URL (legal owner); crawlable `app-ads.txt` from [`docs/app-ads.txt`](./app-ads.txt) once hosted
- Account deletion: visible deadline; completes linked personal data within 30 days; warn that Apple billing may continue and provide system subscription management
- App Store privacy answers: [`APP_STORE_PRIVACY_LABELS.md`](./APP_STORE_PRIVACY_LABELS.md)
- Dependency triage: [`DEPENDENCY_TRIAGE.md`](./DEPENDENCY_TRIAGE.md)

## Optional online services — soft-fail

| Service | Core impact if down | Remaining human gate |
|---------|---------------------|----------------------|
| Supabase / Apple auth | Translate / Camera / Learn / History / Settings stay up | Device Apple sign-in / delete / media storage |
| Ads (AdMob) | Offline → house / none; no network calls offline | Banner + rewarded + interstitial on device; interstitial go/no-go |
| Contributions / rewards | Drafts stay local; sync later | Legal consent; 5 PM NY close; 30-day purge |
| RevenueCat subscription | Guest core unaffected | $0.99 product + sandbox / TestFlight matrix |
| Admin console | Core unaffected | Allowlist ops; deletion queue SLA |

## Founder actions before claiming release

- [ ] F0–F10 merged with green CI and independent review
- [ ] Apple Developer + App Store Connect session; $0.99 subscription live in sandbox
- [ ] Legal: Privacy, Terms, support, retention/deletion, consent copy (18+, media)
- [ ] Bilingual sign-off (UI + Learn alphabet)
- [ ] Device matrix in DEVICE_PROOF complete on the same build
- [ ] Internal then external TestFlight as above
- [ ] Explicit interstitial go/no-go
- [ ] Rollback rehearsed with remote flags
- [ ] Explicit go/no-go for public submission
