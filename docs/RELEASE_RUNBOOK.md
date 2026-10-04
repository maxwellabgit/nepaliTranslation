# Release runbook — Bola V1
Updated 2026-10-03 America/New_York. Owner resumed diagnostic internal TestFlight: build25/exactf670a79 and submission finished, Apple received it and last showed Processing. Apple sign-in expired before final internal availability could be confirmed; availability is not promised. Public release remains gated.
Authority: [INTENT](../.governance/INTENT.md), [decisions](../.governance/V1_G0_DECISIONS.md), [active C0–C15 plan](../plans/active/v1-final-contract-reconciliation.md), [current ledger](../.agent/V1_REQUIREMENT_LEDGER.md).
[Previous runbook](history/2026-10-01-contract/RELEASE_RUNBOOK.md) is preserved as history.

## Current milestone
Diagnostic build25 exactf670a79 and Apple submission finished; last Apple status Processing before sign-in expired. Runtime1ff2a78 plus callback33b6b3d is published. Hosted Auth/migrations/synthetic capture/deletion are verified in [hosted proof](../.agent/GUEST_HOSTED_PROOF_2026-10-03.md); C5SQL/API now deployed and dedicated owner operator grant/sign-in/empty retrieval verified. Collection stays off; activation and nonempty hosted capture/export/download bytes remain pending. Disclosures, signed AdMob console verification and Apple three-storefront prices are approved/saved; legal URLs, RevenueCat/native receipts/store proof remain open. [Consent package](GUEST_CONSENT_OWNER_REVIEW.md) contains approved copy. Build23 is historical.
Diagnostic build25 was uploaded to obtain native evidence. Public V1 remains NO-GO until its evidence gates pass. The current delivery manifest supersedes older pause statements below.

## Before candidate build
- Reconcile current contract; retire reachable review-reward/photo paths safely with forward migrations, without disrupting deletion or historical balances.
- Capture the actual installed iPhone 17 Pro views with provenance, generate each proposal via a separate agent, obtain owner review, implement approved designs and capture matched after states.
- Complete bilingual startup and separate versioned contribution opt-in; authenticated private guest/current-consent/18+/session/flag checks enforced by the server, guest core intact.
- Complete local gamified Today's 10 plus actual answer persistence; typed and speech result feedback share standardized durable capture/outbox/retrieval.
- Prove at least one authorized Today's 10 answer, typed feedback and speech+transcript/result+feedback in admin retrieval/export; retries/revisions do not duplicate or lose data.
- Verify all blocked states upload nothing; actual audio ≤60 seconds; local clips survive process kill/full queue; no new photo uploads; original text preserved separately from normalized export.
- Prove stop-first offline withdrawal/shared-data deletion through private storage/database with owner-bound retry and original 30-day deadline; preserve private identity, credits and local history. Historical full-identity deletion remains backend history.
- Verify welcome 10 / later date 5 credits, ten-minute value, no review rewards, 12-hour cap and restart-safe animation.
- Reconcile ten-minute automatic ads at safe points with retained main reset behavior; banners only idle Translate/Learn; 60-second house rotation without jumps; entitlement suppression.
- Run mobile verify:ci, admin test/typecheck/build, browser scenarios, Deno and fresh/upgraded SQL suites. Attach exact commands, output and SHA. Obtain fresh independent review; fix material findings.
- Preserve existing model certificate and gold. Model optimization is outside this effort; an unresolved release gate remains disclosed.

## TestFlight/device gate
Record exact code SHA, app version/build number, profile, EAS build ID, submission ID, Apple processing result and installed devices.
Use testflight for demo ads; testflight-ssv uses owner units on registered test devices. No revenue claim.
Same-code iPhone 17 Pro and iPad pass: clean install/upgrade/restart, airplane mode, denied permissions, bilingual legal text, opt-in/withdrawal, Today’s 10 resume/Extra 10, typed/mic feedback, Camera focus/highlights/sheet/copy/temp cleanup, queue/revision/private-subject isolation, ads/credits, purchases/restore and accessibility.
Web fixtures and sample videos prove only browser behavior. A screenshots-only pass is not full native functionality proof.

## Hosted and production gate
Owner-controlled Apple/Supabase/AdMob/RevenueCat/legal/bilingual approvals remain required. Prepare all reversible work first.
Verify October migrations/functions on non-production before production. Do not infer hosting from source. Validate private bucket/RLS, deletion scheduler/alerts, retrieval authorization and kill-switch rollback.
Verify live policy/support/deletion URLs, accurate App Store privacy labels, persistent authenticated guest identity and separate optional consent, localized subscription prices if shipping, AdMob readiness, UMP/app-ads.txt and owner live-unit configuration. No secrets in mobile/admin.
Record previous production flags and forward-only rollback. Retired photo/public-review switches must not reopen collection/reward flows.

## Build and submission
Commands are procedures, not proof or automatic authorization. Use exact build IDs, never --latest for submission.
Test candidate: from mobile, npx eas build --platform ios --profile testflight; then npx eas submit --platform ios --profile testflight --id <EAS_BUILD_ID>.
Production after gates and owner authorization: npx eas build --platform ios --profile production; npx eas submit --platform ios --profile production --id <PRODUCTION_EAS_BUILD_ID>.
Test native owner IDs on registered devices before live release. Check production endpoints/IDs in the actual binary; source env edits are insufficient.
Select the processed production build in App Store Connect, attach accurate screenshots/metadata/privacy declarations/review access, and submit for review. Record status; do not call upload public release.

## Stop-ship and rollback
Privacy/auth/data-loss, consent/deletion, ad-interruption/offline-core, migration, device-support, purchase/identity or material independent-review failures remain NO-GO. The recorded failing frozen EN→NE formal/informal certificate still blocks public V1; model optimization is outside this approved effort and no certification waiver was granted.
Disable affected optional flags to recover without breaking guest Translate/Camera/History/Settings/Learn. Preserve records and owner balances. Deadline pressure never converts NOT RUN to PASS.

Owner account-free source4bbd3e1 has full app/backend CI green; that is code/CI proof only. See ../.agent/GUEST_IDENTITY_COMPLETION_2026-10-02.md for hosted/native distinctions. Prepare deployment and verification work, then pause before any new EAS build or submission until the owner resumes it.
