# Bola hosted guest verification — 2026-10-03

Project: Bola, jcrpxoojxixoieqqfgzo, main production. App candidate: 9504fcddd6de2b56405913b5afbb65a979eddfaa (mobile unchanged from4bbd3e1). Owner signed into Supabase and explicitly approved anonymous sign-ins, the two new endpoint gateway settings, and the two existing live function updates. No new TestFlight/EAS build or delivery.

## Database and deployment

- Anonymous Auth enabled and saved; manual linking remains off. Two real authenticated anonymous engineering subjects were issued by hosted Auth; no fabricated JWT or registered-user bypass.
- Initial registry39 included custom20260928220834 credit_minutes_10. Nine missing exact-repository migrations were hashed/reviewed, rehearsed in a rollback transaction, and then applied with registry statements in one transaction. Post-rehearsal registry39/old consent remained unchanged; post-commit registry48/new guest consent and receipt/progress/deletion RPCs verified. Forward20261003003000 then applied after exact-source CI; final independent read verified registry49 and every collection/review flag false.
- Startup2026-10-02.guest.startup and contribution2026-10-02.guest. No historical ledger/profile/consent rows overwritten to pretend they accepted new disclosures.
- New delete-data and record-sample-progress deployed from reproducible esbuild bundles. Approved verify_jwt=false; both validate JWT through Auth and derive/validate owner in SQL. Legacy gateway alone does not authorize sharing. Existing record-consent and submit-translation-report operated successfully against the new SQL contract; no gratuitous redeploy.
- process-scheduled-jobs replaced with deletion-only worker; public-review replaced with410/review_retired. No service key enters app/admin/browser source. Dashboard source bundles contain only environment variable lookups.
- Existing minute cron was verified through redacted command structure and actual net responses. Responses16:00/16:01/16:02UTC returned200/no timeout/reward_close retired=true/applied=0. No rotation/lookahead/validation cron existed. Old deployed worker temporarily re-enabled public review before replacement; the replacement and retirement flag were verified afterwards.
- Shared-data dispatcher now starts before the deadline instead of waiting until day30. Original due_at stays intact, storage-first stages/backoff remain; historical full-identity timing unchanged. No deadline fixture acceleration or manual completion was used for the live purge.

## Actual synthetic round trip

Only explicitly marked synthetic engineering content was uploaded; no user text, voice, photo or legal/bilingual approval was fabricated. Temporary guest credentials never entered logs or Git.

Subject27f4a186-5fac-4cf9-9c55-36367ec954c1; isolation subject9d5a11df-75b0-447c-b69c-864f4b3b2538. Hosted real Auth/current guest JWTs confirmed.

- General startup acceptance alone left optional consent null and speech off; typed upload rejected403. Different guest saw zero rows for the first subject's private profile through RLS.
- Separate specific engineering opt-in via record-consent succeeded; renewed permission left speech false.
- Typed original/result/correction and rating metadata uploaded once. Retry returned409 and the same report053da125-81b0-40f8-826b-2e034cb69e5d. Sample progress334/370 was received once with no credit reward.
- Privileged hosted retrieval confirmed one report, exact original/model/revision retained, and one progress row. This is real database retrieval; it is not a completed admin-browser export journey.
- Public key alone could not delete (401); forged subject payload rejected400. Owner delete-data returned scheduled=true/deleted=false; immediate retry preserved original deadline2026-11-02T16:06:41.093677+00:00. Subsequent upload rejected403; identity remained authenticated.
- Actual minute cron completed at2026-10-03T16:07:00.28131+00:00, about19seconds after request, without shortening the recorded deadline. storage_completed/database_completed=true, stage complete, last_error null. Typed report and progress counts became0. Private identity and17 synthetic seeded credits remained. These17 credits test preservation, not an AdMob/StoreKit earning receipt.
- Post-purge guest HTTP checks confirmed consent null, speech false, deletion_purged_at real, identity valid and lifetime_credits17. Two historical public-review ledger rows remained2; no clawback.
- Speech/photos were already disabled; no actual audio object was uploaded. Storage authorization/listing and empty-owner purge ran, but nonempty binary-media purge still requires separate proof.

## Verification and release limits

Exact9504fcd [backend37135168483](https://github.com/maxwellabgit/nepaliTranslation/actions/runs/37135168483) SUCCESS: real anonymous Auth, SQL335 on fresh and clean upgraded schemas, Edge63, concurrent grants, pre-fix data preservation and admin. [Agent37135168426](https://github.com/maxwellabgit/nepaliTranslation/actions/runs/37135168426) SUCCESS: mobile604/unchanged coverage, browser, export/pins/secrets. Prior scheduler candidate d2d3379 also had both gates green. Fresh independent scheduler and dispatcher reviews PASS, no material findings.

After the synthetic proof, collection remains off pending required legal/bilingual/native sign-off: text=false, speech=false, photos=false; retired public_review=false. Existing ads/purchase settings were not enabled by this work. Private guest/deletion services remain available and core is independent of online services. No staging paid branch was created; rollback rehearsal is not an incident backup-restore drill.

Still unverified: current native iPhone/iPad, real StoreKit/AdMob serving/SSV, actual nonempty audio-object purge, authenticated admin-browser retrieval/export, published legal URLs/current App Store answers and owner bilingual/legal approval. See [owner consent package](../docs/GUEST_CONSENT_OWNER_REVIEW.md), [device checklist](../docs/DEVICE_PROOF.md), and [release runbook](../docs/RELEASE_RUNBOOK.md). Public V1 remains NO-GO; TestFlight delivery stays paused by owner request.

Reviewed deployment artifacts: guest-hosted-deployment/manifest.json, dispatch-manifest.json, endpoint source/bundle manifest, deploy/rehearse/dispatch SQL and synthetic proof script. Transient local transfer page/logs and guest credentials are cleaned after proof; synthetic server identities intentionally survive to demonstrate preservation.
