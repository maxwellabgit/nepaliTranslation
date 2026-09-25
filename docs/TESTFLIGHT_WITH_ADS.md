# Internal TestFlight: review prompts and test ads

This branch prepares an internal iPhone/iPad build. Staging migrations, review import, scheduler close, and deletion retry are recorded in `.agent/V1_FINAL_CONTRACT_STATE.md`; there is still no recorded Apple upload, device ad impression, or signed rewarded callback. Keep public V1 closed until the requirement ledger and four-class model certificate pass. Tell internal testers that the pinned base English→Nepali model fails the shipped-path formal and informal chrF floors (0.4740 < 0.55; 0.3976 < 0.50) and produces no informal तिमी on that run. The E1 adapter is not in the app.

## What this change provides

- `balance_data/review_pool/for_review.jsonl`: 200 owner-authorized review prompts, 135 with clearly unverified machine suggestions and 65 source-only. The former blind benchmark split is retired. Neither prompts nor reviewer responses are approved training or evaluation references. Import only registry corpus `balance-public-review-prompts`, never the gold corpora.
- Source-only items require a written `edit`; the phone disables `confirm` and the new database trigger rejects a forged confirmation. Direct authenticated submission inserts are removed; the RPC enforces the release flag and eligibility and snapshots the actual window credits. Submitted rewards still depend on a real close, admin review, and the hosted scheduler.
- The `testflight` EAS profile bundles Google's demo ad IDs. The `testflight-ssv` profile uses owner-owned AdMob iOS IDs **only on enrolled test devices**, which allows the owner's rewarded unit to send a signed server-side verification callback. Both profiles serve test ads; neither is a claim of ad revenue.
- The optional rewarded button is reachable from Settings for signed-in accounts after `rewarded_ads_enabled` is turned on. Ad banners and the Settings privacy-options link update when UMP finishes after the first screen render.

## Hosted setup before showing review or promising rewards

1. Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` for the EAS **preview** environment; both TestFlight profiles explicitly use preview, while the production profile uses production. Staging `jcrpxoojxixoieqqfgzo` has recorded 38 applied migrations, 16 active functions, 200 imported prompts, 20 private windows, two-account ownership checks, successful scheduler calls, and a deletion retry that cleared storage, database, and auth. Confirm those receipts against the hosted project before enabling additional flags. Never put the service-role key or `CRON_SECRET` in EAS or the admin browser.
2. Keep `public_review_release_approved` and `public_review_enabled` false until a separate rights and release decision. The recorded lookahead covers 20 days, not the 28-day target. Contributor media, paywall, telemetry, and deletion-processing flags remain off until their own gates pass.
3. Configure an owner rewarded AdMob unit and a signed SSV receipt on staging. The Google demo unit in `testflight` cannot prove reward credit. Keep `rewarded_ads_enabled` off until an owner-unit callback and transaction replay show exactly one permanent grant.
4. Enable `network_ads_enabled` in staging for the internal cohort only after consent is configured and verified. Force quit and relaunch the app after changing a hosted flag; flags are fetched on startup. Enable `automatic_interstitial_enabled` only when testing the 15-minute foreground timer and allowed safe points on both devices.

## Two ad modes

| Profile | iOS identifiers | Reward verification |
| --- | --- | --- |
| `testflight` | Bundled Google demo app and ad units, even if shared EAS variables contain owner IDs | Ad presentation only; do not promise an SSV credit |
| `testflight-ssv` | Owner iOS app and banner/interstitial/rewarded units, registered AdMob test devices | Configure the owner's rewarded unit for amount `30`, item `ad_free_minutes`, and `https://<project-ref>.supabase.co/functions/v1/admob-ssv` |

For `testflight-ssv`, configure `EXPO_PUBLIC_ADMOB_IOS_APP_ID`, `EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID`, `EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID`, `EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID`, and comma-separated `EXPO_PUBLIC_ADMOB_TEST_DEVICE_IDS` in EAS **preview**. Use the device IDs reported by the native SDK and add those devices in the AdMob console. The Edge Function secret `ADMOB_REWARDED_UNIT_ID` must contain **the same full owner rewarded unit ID**. The signed callback carries its numeric suffix, which the verifier now matches to that full configured ID. Test a signed callback and replay against staging; expect exactly 2 credits / 30 ad-free minutes once. Avoid live ad requests or clicking ads during tests.

## Build and acceptance

With owner Expo/Apple access and reachable pinned model bundles, run from `mobile/`: `npm ci`, `npm run verify:ci`, `npx eas build --platform ios --profile testflight-ssv`, then `npx eas submit --platform ios --profile testflight-ssv --latest`. Use `--profile testflight` first if the owner AdMob unit or SSV setup is unavailable, and do not enable rewarded credits for that build. Record the git SHA, build number, pinned ONNX hashes, backend project, and ad profile in `docs/DEVICE_PROOF.md`. Test the **same build** on a real iPhone and iPad, including airplane-mode translation, banner locations, 15-minute interstitial safe points, a signed rewarded callback and replay, ad suppression with subscription, guest consent, source-only review, and account withdrawal. Use test accounts and screenshots without personal content.

Open gates remain: the exact ONNX weights and four-class model PASS, signed hosted SSV receipt and replay, real iPhone/iPad device matrix, Apple/RevenueCat console work, live legal URLs, and the requirement 1–30 PASS ledger. Staging, local database upgrade, schedule, and deletion have recorded evidence in `.agent/V1_FINAL_CONTRACT_STATE.md`. Internal TestFlight is a diagnostic build only until its own applicable gates pass; public V1 remains NO-GO.
