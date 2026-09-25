# Internal TestFlight: review prompts and test ads

This branch prepares an internal iPhone/iPad build. It does **not** record a hosted deployment, an Apple upload, an ad impression, or a reward. Keep public V1 closed until the requirement ledger and four-class model certificate pass. Tell internal testers that the pinned base English→Nepali model fails the shipped-path formal and informal chrF floors (0.4740 < 0.55; 0.3976 < 0.50) and produces no informal तिमी on that run. The E1 adapter is not in the app.

## What this change provides

- `balance_data/review_pool/for_review.jsonl`: 200 owner-authorized review prompts, 135 with clearly unverified machine suggestions and 65 source-only. The former blind benchmark split is retired. Neither prompts nor reviewer responses are approved training or evaluation references. Import only registry corpus `balance-public-review-prompts`, never the gold corpora.
- Source-only items require a written `edit`; the phone disables `confirm` and the new database trigger rejects a forged confirmation. Direct authenticated submission inserts are removed; the RPC enforces the release flag and eligibility and snapshots the actual window credits. Submitted rewards still depend on a real close, admin review, and the hosted scheduler.
- The `testflight` EAS profile bundles Google's demo ad IDs. The `testflight-ssv` profile uses owner-owned AdMob iOS IDs **only on enrolled test devices**, which allows the owner's rewarded unit to send a signed server-side verification callback. Both profiles serve test ads; neither is a claim of ad revenue.

## Hosted setup before showing review or promising rewards

1. Supply the staging project URL and publishable/anon key to the EAS mobile environment. Store the Supabase service-role key and `CRON_SECRET` as Edge Function secrets; use the service key only in a temporary operator shell for the import. Link and migrate a **non-production** Supabase project, deploy the Edge Functions, and run fresh and upgrade SQL tests before relying on the new trigger. No hosted credentials are present in this workspace.
2. From the repository root, run `deno run --allow-env --allow-net --allow-read --allow-write --allow-run=git supabase/scripts/import_review_pool.ts --corpus=balance-public-review-prompts --dry-run`. Inspect `datasets/review_import_rejects.json`. With `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set in the operator's shell, run the same command without `--dry-run`, then verify imported row counts and public-display eligibility in staging. Never put the service key in EAS or the admin browser.
3. Configure and verify a real hosted every-minute call to `process-scheduled-jobs` using `CRON_SECRET`; the YAML in `supabase/functions/schedules/` is only a template. Verify 5:00 PM New York review close and deletion due processing with receipts. Seed private 14-day lookahead and verify ten unique rows per window. `public_review_release_approved` and `public_review_enabled` stay false until rights and hosted proofs have passed. Test two accounts' ownership, consent withdrawal, storage purge, and deletion before enabling contributions or rewards.
4. Enable `network_ads_enabled` for the internal cohort only after staging returns the intended feature config and the consent flow is verified. Enable `rewarded_ads_enabled` only after the signed SSV transaction succeeds and a replay grants no extra credit. Enable `automatic_interstitial_enabled` only after the foreground timer and allowed safe points pass on both devices. Leave paywall, media, telemetry, and deletion-processing flags off until their own hosted proofs exist.

## Two ad modes

| Profile | iOS identifiers | Reward verification |
| --- | --- | --- |
| `testflight` | Bundled Google demo app and ad units, even if shared EAS variables contain owner IDs | Ad presentation only; do not promise an SSV credit |
| `testflight-ssv` | Owner iOS app and banner/interstitial/rewarded units, registered AdMob test devices | Configure the owner's rewarded unit for amount `30`, item `ad_free_minutes`, and `https://<project-ref>.supabase.co/functions/v1/admob-ssv` |

For `testflight-ssv`, configure `EXPO_PUBLIC_ADMOB_IOS_APP_ID`, `EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID`, `EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID`, `EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID`, and comma-separated `EXPO_PUBLIC_ADMOB_TEST_DEVICE_IDS` in EAS. Use the device IDs reported by the native SDK and add those devices in the AdMob console. The Edge Function secret `ADMOB_REWARDED_UNIT_ID` must contain **the same full owner rewarded unit ID**. The signed callback carries its numeric suffix, which the verifier now matches to that full configured ID. Test a signed callback and replay against staging; expect exactly 2 credits / 30 ad-free minutes once. Avoid live ad requests or clicking ads during tests.

## Build and acceptance

With owner Expo/Apple access and reachable pinned model bundles, run from `mobile/`: `npm ci`, `npm run verify:ci`, `npx eas build --platform ios --profile testflight-ssv`, then `npx eas submit --platform ios --profile testflight-ssv --latest`. Use `--profile testflight` first if the owner AdMob unit or SSV setup is unavailable, and do not enable rewarded credits for that build. Record the git SHA, build number, pinned ONNX hashes, backend project, and ad profile in `docs/DEVICE_PROOF.md`. Test the **same build** on a real iPhone and iPad, including airplane-mode translation, banner locations, 15-minute interstitial safe points, a signed rewarded callback and replay, ad suppression with subscription, guest consent, source-only review, and account withdrawal. Use test accounts and screenshots without personal content.

Open gates remain: the exact ONNX weights and four-class model PASS, staging deployment and database upgrade proof, hosted schedule/deletion/SSV receipts, real iPhone/iPad device matrix, Apple/RevenueCat console work, live legal URLs, and the requirement 1–30 PASS ledger. Internal TestFlight is a diagnostic build only until its own applicable gates pass; public V1 remains NO-GO.
