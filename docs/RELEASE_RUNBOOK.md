# Release runbook (TestFlight → App Store)

**Status: BLOCKED — founder Apple Connect / legal / bilingual sign-off**

Do not claim App Store submission from this document or from Windows CI. Use this as the human sequence after foundation merge and device proof ([`DEVICE_PROOF.md`](./DEVICE_PROOF.md)).

## Sequence

1. **Internal TestFlight** — Build with `eas build --platform ios --profile preview` or `production`, submit with `eas submit --platform ios --latest`. Invite founder + engineering only. Smoke: Translate, Camera, Learn, History, Settings; airplane mode; Mark incorrect draft.
2. **External TestFlight cohort** — 25–50 bilingual EN/NE reviewers. Collect: register (तिमी informal), Camera OCR, speech permission UX, Learn romanization. No “beta” wording in public App Store metadata later.
3. **Phased public** — App Store release candidate after external feedback triage. Roll out gradually if Connect supports phased release; otherwise short staggered invite waves then public.

## Monitoring

- Crash / hang reports in App Store Connect / Xcode Organizer
- Support inbox: `support@neptranslate.app` (inappropriate ads already linked from Settings)
- Feature flags: keep `network_ads_enabled` / `rewarded_ads_enabled` / contributions off until legal + AdMob device gates pass
- Do not treat gold-benchmark edits as a release lever

## Rollback

- Pause external TestFlight / phased release in App Store Connect
- Ship a hotfix build via EAS → submit → promote previous build if needed
- Remote flags: disable ads / contributions / rewards without breaking offline Translate / Camera / Learn
- Never roll back by editing `benchmarks/gold/` references

## Support

- In-app: Settings → quality note (Mark incorrect); Contributions & rewards for drafts; report inappropriate ad mailto
- Out-of-band: Apple Connect reviewer notes, privacy policy / support URL (legal owner)
- Account deletion: Sign in with Apple path only; deleting the app account does not cancel an Apple subscription (when subscription ships)

## Optional online services — soft-fail (source)

| Service | Core impact if down | Remaining human gate |
|---------|---------------------|----------------------|
| Supabase / Apple auth | Translate / Camera / Learn / History / Settings stay up | Device Apple sign-in / delete |
| Ads (AdMob) | Offline → house / none; no network calls offline | AdMob EAS on physical iPhone |
| Contributions / rewards | Drafts stay on device; sync later | Legal consent copy; flags off until approved |
| RevenueCat subscription | N/A until Slice 09+ of beta program | StoreKit / RevenueCat product + sandbox |

Subscription product work remains **beta Slice 09+** (deferred relative to this production-readiness pass). Do not claim IAP shipped from docs alone.

## Founder actions before claiming release

- [ ] Apple Developer + App Store Connect access session
- [ ] Legal: privacy policy, support URL, consent copy beyond draft
- [ ] Bilingual sign-off (Learn alphabet + sample translations)
- [ ] Internal then external TestFlight as above
- [ ] Explicit go/no-go for public submission
