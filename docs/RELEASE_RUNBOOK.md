# Release runbook (TestFlight → App Store)

**Status: BLOCKED — R0–R9 evidence incomplete; founder Apple Connect / legal / bilingual sign-off / physical device matrix / hosted ops**

Do not claim App Store submission or external RC from this document or from Windows CI. Product boundary: [`.governance/INTENT.md`](../.governance/INTENT.md). Contract: [`.governance/V1_G0_DECISIONS.md`](../.governance/V1_G0_DECISIONS.md). Ship program: [`plans/active/v1-testflight-runbook.md`](../plans/active/v1-testflight-runbook.md). Audit trail: [`docs/NepTranslate_V1_Finalization_and_TestFlight_Runbook_71c85df.md`](./NepTranslate_V1_Finalization_and_TestFlight_Runbook_71c85df.md).

**Honesty:** Neither `43f9bc6` nor `71c85df` (the G0–G5 stack merged to `main`) is an external release candidate. `71c85df` was audited 2026-09-22 and found red on `js-verify`, `playwright-scenarios`, and `supabase`. The first useful milestone is a **green R0+R1 diagnostic internal TestFlight** with contribution, live ads, paywall, telemetry, and deletion processing **off**, targeting **staging** services with **Google test ad units**.

## Product freeze (must match INTENT)

- Ad-free subscription: **US $0.99/month** (StoreKit authoritative); **sign-in required** before purchase/restore; RevenueCat ID = Supabase UUID
- Ads: banners idle Translate + Learn only; automatic interstitial **15 minutes since last successful impression** / ≤3 per America/New_York day / safe idle only / SDK dismiss / remotely disableable; TestFlight = **test ad units**
- Rewarded video: **1 credit / 15 ad-free minutes** after SSV; real SDK event contracts
- Rewards: **1 credit = 15 minutes**; top-50%-longest samples at assignment = 2 credits; rotation **5:00 PM America/New_York**; admin can mark submissions unsatisfactory before close; no clawback; late reject → alert only
- Public review: **global 10 items/day**, same set for every reviewer, refreshed at 5:00 PM America/New_York; all training + benchmark corpora eligible after PII/dedup; submissions never re-enter training/eval without a separate verified migration
- Startup consent gate: every user acknowledges **T&C + Privacy Policy + "I am 18+"** before reaching any product surface
- Contributions: signed-in only; **photo + raw speech + corrections** upload when flagged; account-linked; withdrawal + 30-day purge of all rows/objects tied to `user_id`
- Platforms: iPhone **and** iPad; UI English **and** नेपाली

## Sequence

1. **R0 (this branch class) + R1 evidence** — Green js-verify / playwright / supabase on the exact commit; camera copy accurate; version `1.7.0`; dedicated `testflight` EAS profile with test ads; build-provenance surface reachable in Settings; forward-only migration repairs reward idempotency / 5 PM ownership / DST / exactly-once close.
2. **Internal TestFlight (bridge R1 → R4)** — Build R0+R1 commit with `testflight` profile, target **staging** Supabase, `EXPO_PUBLIC_ADS_ENV=test`, and remote flag snapshot below (see also `plans/active/v1-testflight-runbook.md`):

   | Flag | First internal build |
   |---|---:|
   | `contribution_text_enabled` | false |
   | `contribution_speech_enabled` | false |
   | `contribution_photos_enabled` | false |
   | `rewards_enabled` | false |
   | `network_ads_enabled` | false |
   | `rewarded_ads_enabled` | false |
   | `automatic_interstitial_enabled` | false |
   | `paywall_enabled` | false |
   | `telemetry_enabled` | false |
   | `deletion_processing_enabled` | false |
   | `learn_enabled` | true |

   Smoke: startup consent (EN + नेपाली), typed Translate, Camera, Learn, History, Settings, airplane mode, iPhone + iPad. Fill [`DEVICE_PROOF.md`](./DEVICE_PROOF.md) on this build. Physical-device / mic / camera / StoreKit / AdMob / interstitial / crash evidence live here, not in CI.

3. **R2 → R5** — Enable one subsystem at a time for internal accounts (review + admin adjudication → speech + photo contribution → rewarded/interstitial ads → RevenueCat paywall). Prove each in the harness first, then on device, then flip on for a limited internal cohort. Preserve the previous kill-switch state for immediate rollback.
4. **R6** — Neural EN→NE quality lift and new **private** uncontaminated holdout. Do not lower the frozen thresholds.
5. **R7 + R8** — Mobile/iPad polish and Windows testing-ground coverage; deploy migrations/functions/cron/backups/legal URLs on staging and rehearse rollback.
6. **External TestFlight cohort (R9)** — Small bilingual EN/NE cohort. Enable contribution collection only after legal approval. Enable **automatic interstitial only** after explicit go/no-go.
7. **Stability gate** — Seven consecutive America/New_York days with no open P0/P1, deletion deadline breaches, privacy leaks, crash regressions, or reward ledger inconsistencies.
8. **Freeze + phased public** — Complete freeze worksheet, rehearse rollback, submit the **exact** tested build with unique remote build number.

## Exact TestFlight go/no-go (external RC)

Do not call a build the V1 release candidate until every item is true:

- [ ] Rewarded and interstitial loading uses real SDK event contracts and passes on-device tests
- [ ] Fifteen active minutes means fifteen minutes since the last successful impression; daily cap is three
- [ ] Rewarded verification grants exactly fifteen ad-free minutes once
- [ ] Banners/interstitials/rewarded use test ads in TestFlight; production units remain gated
- [ ] AdMob app readiness and app-ads.txt verified before expecting revenue
- [ ] RevenueCat identity tied to signed-in Supabase user before purchase/restore
- [ ] Purchase, restore, refund/revocation, billing retry, reinstall, and second device pass
- [ ] Eligible corpus importer and reconciliation manifest exist
- [ ] Frozen benchmarks and copies cannot enter public review
- [ ] Users receive up to ten exclusive public assignments per New York review day
- [ ] Completed reviews globally retired from review, training, and evaluation
- [ ] Credits grant one/two correctly at or before 5:00 PM boundary and never claw back
- [ ] Late rejection creates an alert exactly once
- [ ] Hosted scheduler provisioned, monitored, and tested across DST
- [ ] Admins can adjudicate before close and see pool/credit/deletion status
- [ ] Consent and permission copy truthfully describe automatic photo uploads and retention; speech-media not falsely promised
- [ ] Consent withdrawal and account deletion purge all linked data within 30 days
- [ ] Exact models fetched, hashed, evaluated, and proven on iPhone and iPad
- [ ] Typed fallback works offline when neural translation is unavailable
- [ ] Camera/OCR/speech/TTS/highlight alignment pass on physical devices
- [ ] Production secrets, legal/support URLs, telemetry, backups, alerts, and kill switches pass
- [ ] This runbook and DEVICE_PROOF contain no open blockers for the candidate build


## Interstitial go/no-go (explicit)

Automatic interstitial stays **off** until a human records a decision. Default for public launch: **leave off**.

| Decision | Owner | Date | Build | Notes |
|----------|-------|------|-------|-------|
| [ ] Keep `automatic_interstitial_enabled` **off** for public V1 | | | | Recommended until external cohort is clean |
| [ ] Enable for external TestFlight only | | | | Max 3 / America/New_York day; SDK dismiss; remote kill switch verified |
| [ ] Enable for App Store phased release | | | | Only after seven clean external days + support review |

Do not treat code landing or Playwright as interstitial enablement.

## Seven-day external stability log

Record one row per America/New_York calendar day during external TestFlight. Leave empty until humans run the cohort.

| Day (NY date) | Build | Open P0/P1 | Deletion SLA OK | Privacy/crash OK | Reward ledger OK | Sign-off |
|---------------|-------|------------|-----------------|------------------|------------------|----------|
| 1 | | [ ] none | [ ] | [ ] | [ ] | |
| 2 | | [ ] none | [ ] | [ ] | [ ] | |
| 3 | | [ ] none | [ ] | [ ] | [ ] | |
| 4 | | [ ] none | [ ] | [ ] | [ ] | |
| 5 | | [ ] none | [ ] | [ ] | [ ] | |
| 6 | | [ ] none | [ ] | [ ] | [ ] | |
| 7 | | [ ] none | [ ] | [ ] | [ ] | |

Any open P0/P1 resets the seven-day counter.

## Freeze worksheet (before App Store submit)

Fill on the exact build that will be submitted. Do not submit if any required row is blank.

| Item | Value / link |
|------|----------------|
| Version + build | |
| Git SHA | |
| IT2 ONNX SHA-256 (both directions) | must match release manifest + [`MODEL_CERT.md`](./MODEL_CERT.md) floors if gold eval ran |
| Supabase migrations tip | |
| Remote feature-flag snapshot | |
| App Store privacy answers | from [`APP_STORE_PRIVACY_LABELS.md`](./APP_STORE_PRIVACY_LABELS.md) |
| Screenshots / description / review notes | |
| Support contact | |
| Rollback rehearsal result | see below — date + flags flipped |

## Rollback rehearsal (required before public)

On a non-production or internal build with optional flags **on**:

1. [ ] Flip remote flags to disable ads (including interstitial), contributions, media upload, rewards, and paywall.
2. [ ] Confirm offline Translate, Camera, and Learn still work (airplane mode).
3. [ ] Confirm no requirement to edit `benchmarks/gold/` or ship a new IPA solely to disable optional services.
4. [ ] Record date, operator, and flag snapshot: ____

## Monitoring

- Crash / hang reports in App Store Connect / Xcode Organizer
- Support inbox and inappropriate-ad reporting (Settings)
- Feature flags (independent):
  - `contribution_text_enabled` / `contribution_speech_enabled` / `contribution_photos_enabled`
  - `network_ads_enabled` / `rewarded_ads_enabled` / `automatic_interstitial_enabled`
  - `paywall_enabled` / `telemetry_enabled` / `deletion_processing_enabled`
- Review retention, ad complaints, subscription conversion, translation/camera failure rates before interstitial go-live
- Do not treat gold-benchmark edits as a release lever

## Rollback (production incident)

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

## Public App Store go/no-go checklist

Production V1 public submission is allowed only when **all** are checked by a human. Prefer the detailed **Exact TestFlight go/no-go** list above; this section is the final submit gate:

- [ ] G0–G7 complete with green CI and independent review where applicable
- [ ] Exact model artifacts pass frozen evaluation (soft missing-weights CI is **not** enough) — [`MODEL_CERT.md`](./MODEL_CERT.md)
- [ ] iPhone and iPad matrices in [`DEVICE_PROOF.md`](./DEVICE_PROOF.md) pass on the **same** TestFlight build
- [ ] RevenueCat identity = Supabase UUID; purchase/restore/refund/reinstall/second-device certified; Sign-In, media storage, deletion, admin ops pass production-like
- [ ] Ads use real SDK contracts; TF test units; production units + app-ads.txt ready before revenue expectation
- [ ] Public-review pool live under eligibility rules; 5 PM grants + late alerts; hosted scheduler verified
- [ ] Consent withdrawal + 30-day purge of all linked data; privacy copy matches photo upload behavior; speech-media not falsely promised
- [ ] Privacy/Terms/support URLs and App Store privacy answers are live and accurate
- [ ] Bilingual UI and alphabet content receive human sign-off
- [ ] External TestFlight: small cohort; seven clean consecutive America/New_York days (log above)
- [ ] Interstitial go/no-go explicitly recorded
- [ ] Freeze worksheet complete; rollback rehearsed with remote flags
- [ ] Explicit final go for public submission — owner: ____ date: ____

## Founder actions before claiming release

- [ ] Apple Developer + App Store Connect session; $0.99 subscription live in sandbox
- [ ] Legal: Privacy, Terms, support, retention/deletion, bilingual consent copy (18+, photo; speech deferred)
- [ ] Hosted 5 PM credit + 30-day deletion schedulers provisioned and monitored
- [ ] Complete public go/no-go checklist above
