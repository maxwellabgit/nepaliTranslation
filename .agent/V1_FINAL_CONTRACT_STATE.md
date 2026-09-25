status: IN_PROGRESS
integrated_code_sha: e0c4f4fe2841721b1708bca2f2ae8f8d2fc8af2f
previous_main_sha: 0f7e40f0d5457b1659afe25f3c9ac276fe850e50
branch: main
pr: https://github.com/maxwellabgit/nepaliTranslation/pull/15
pr_state: MERGED
merge_method: fast-forward
current_step: 2 complete. Staging project jcrpxoojxixoieqqfgzo is linked, migrated, and has the Edge Functions deployed. Step 3 is the rights-cleared review import and is not started. The every-minute scheduler is not installed.
completed_gates: C0, C1 were recorded before this merge. This merge does not close C2–C15.
internal_testflight: NO-GO
public_v1: NO-GO
optional_production_flags: off. production EAS profile does not set EXPO_PUBLIC_ADS_ENV. Unset ads env stays test. testflight uses Google demo units. testflight-ssv requires owner units and registered test-device IDs at build time. public_review_release_approved and public_review_enabled stay false until a separate owner approval. Contribution, ads, paywall, telemetry, and deletion-processing flags stay off.
ci_on_integrated_sha: agent-gates run 36176633407 and backend-gate run 36176632996 succeeded on e0c4f4fe2841721b1708bca2f2ae8f8d2fc8af2f. Mobile 370 unit tests, 19 integration tests, 70 browser scenarios. Backend 58 Deno tests and fresh plus upgraded database suites of 28 files and 264 assertions each. ship-cert checked pins only and is not a four-class model PASS. These are code and local-database proofs.
model_certificate: shipped-path FAIL in docs/MODEL_CERT.md. formal EN to NE chrF 0.4740 < 0.55. informal EN to NE chrF 0.3976 < 0.50 and तिमी rate 0%. ne_en_deva 0.6901 and ne_en_roman 0.4854 passed on that run. Gold rows and floors were not changed.
review_inventory: 200 prompts in balance_data/review_pool/for_review.jsonl. 135 unverified suggestions, 65 source-only. Import requires --corpus=balance-public-review-prompts. Gold and training corpora are not_for_public_review. Not imported to a hosted project.
staging_supabase: project jcrpxoojxixoieqqfgzo. Owner confirmed it is non-production. 38 migrations applied, including 20260925160000. public.app_config and public.review_windows exist. Private buckets contribution-speech and contribution-photos exist and are not public. All app_config booleans are false, including contribution, ads, paywall, telemetry, deletion processing, public_review_enabled, and public_review_release_approved. Sixteen Edge Functions are ACTIVE. GET /functions/v1/health returned 200 {"ok":true,"service":"neptranslate"}. A rolled-back transaction created two temporary auth users and checked them against each other: startup consent, contribution consent, sharing toggles, deletion request, withdrawal, and deletion status returned 42501 forbidden; user A saw 0 of user B's review submissions and 0 of user B's profile; user A could set their own sharing toggles; review submit returned P0001 flag_disabled. Leftover users, review submissions, and deletion requests are 0. No service-role key was written into the mobile or admin environment. The service role stays in Supabase's Edge Function secret injection.
human_blockers: hosted scheduler is not installed; private-bucket upload and purge receipt is not witnessed; signed AdMob callback, App Store price check, RevenueCat sandbox purchase, and same-build iPhone and iPad matrix are absent. Review prompts are not imported.
next_action: Dry-run and then import only --corpus=balance-public-review-prompts on this staging project. Keep optional production flags off. Do not treat step 2 as a scheduler, ad, purchase, or device proof.
updated_at_utc: 2026-09-25T19:45:00Z
