# NepTranslate V1 Finalization and TestFlight Runbook

> **Historical audit record.** Captured against `71c85df` on 2026-09-22. Do not edit the findings or the prices in this file to match a later contract. The living contract is `plans/active/v1-final-contract-reconciliation.md`.

**Audited revision:** `71c85df5a4a7ba238c3496ed243ea0b25b027d91` on `origin/main`  
**Audit date:** September 22, 2026  
**App:** NepTranslate (`com.neptranslate.app`)  
**EAS project:** `4d0a21e4-5c2e-45fa-b8fd-86a996abb404`  
**App Store Connect app ID:** `6792574384`

## Executive decision

Do **not** label or submit `71c85df` unchanged as the production V1 release candidate. All G0–G5 commits are already present on `main`, but the integrated result is not release-ready:

- GitHub's JavaScript, Supabase, and Playwright checks are red at the audited commit.
- The local mobile gate stops in the new AdService contract test even though lint and type checking pass.
- Public-review reward SQL has a broken conflict target and does not reliably extend the user's earned ad-free entitlement.
- The every-minute scheduler can attempt premature review-window closure rather than returning `not_due`.
- The source pool can recycle already-reviewed data and does not exclude reviewed/publicly exposed material from future training or evaluation.
- The public-review mobile experience and corresponding admin review console do not yet exist.
- Startup consent, consent withdrawal, account deletion, raw-speech upload, ads, subscriptions, and operational deployment still lack required end-to-end proof.
- The exact neural English→Nepali model fails the frozen ship-quality thresholds. The local phrase/lexicon fallback still passes its deterministic checks.

Use two distinct release targets:

1. **Internal TestFlight diagnostic build:** install on the owner's iPhone/iPad as soon as R0 and R1 restore a green release baseline. Keep all optional network, monetization, contribution, media, and deletion-processing flags off. This build is for native UI, microphone, camera, offline translation, startup consent, layout, and crash testing. It is not the V1 release candidate.
2. **External V1 release candidate:** enable subsystems one at a time only after every finalization lane below passes. Neural English→Nepali must pass the frozen model certificate before it is the default production path.

## Frozen product contract

Do not silently change these decisions while fixing implementation defects.

| Area | V1 contract |
|---|---|
| UI languages | English and Nepali, selectable in-app and on first-launch consent |
| Devices | iPhone and iPad |
| Core translator | Useful without sign-in; on-device/offline basic translation must remain available |
| Public review pool | One global set of 10 source items per New York day; all eligible users see the same 10 |
| Rotation | 5:00 PM `America/New_York`, including DST behavior |
| Review eligibility | Registered training and benchmark corpora are initially eligible, subject to privacy, provenance, malformed-data, and safety checks |
| Review reward | Bottom half by source word count: 1 credit; top half: 2 credits; 1 credit = 15 ad-free minutes |
| Reward timing | At window close; if staff did not mark an eligible submission unsatisfactory before close, grant it. Never claw back a granted credit |
| Late rejection | Preserve the reward and add an admin-visible contributor alert; no automatic punishment |
| Sign-in | Required before purchase, restore, text/media contribution, or review reward |
| Startup acceptance | Terms, Privacy Policy, and 18+ confirmation on one explicit bilingual gate |
| Contributions | Adults 18+ only; translation remains usable without contributing |
| Media upload | Eligible speech/photos may upload automatically after sign-in and explicit contribution consent |
| Retention | Retain contributed media until consent withdrawal or account deletion; then alert administrators and delete linked data within 30 days |
| Subscription | $0.99/month ad-free, subject to final App Store product configuration |
| Interstitial cadence | After 15 minutes of foreground-active time, only at a safe opportunity, maximum 3 per New York day |
| Rewarded ad | 1 verified impression = 1 credit = 15 ad-free minutes |

For public review, make the reward rule explicit: `confirm` and `edit` are reward-eligible; `skip` is not a review and earns nothing; `report` quarantines the item and earns no automatic credit. If the product later wants a reward for a valid report, implement it as a separate, admin-approved reward source rather than silently treating every report as a correction.

## Evidence from the audited build

| Check | Result at `71c85df` | Release meaning |
|---|---|---|
| GitHub `js-verify` | Fail | Main is not a green release base |
| GitHub `supabase` | Fail | Database changes are not certified |
| GitHub `playwright-scenarios` | Fail | Windows testing-ground flow is not certified |
| Admin check | Pass | Necessary, not sufficient |
| Secret scan | Pass | Necessary, not sufficient |
| Model hash | Pass | Files match the manifest; quality still fails |
| Local lint/typecheck | Pass | Static mobile checks are healthy |
| Local unit tests | 73 suites pass; one suite fails to transform | Fix the hoisted Jest mock in `AdService.voidLoadContract-test.ts` |
| Local integration tests | 19 tests pass | Core integration baseline remains useful |
| Translation/romanization checks | Pass | Basic deterministic fallback remains available |
| Expo Doctor | 21/21 | SDK/package shape is currently valid |
| Web export | Pass | Expo web bundle can be produced |
| Windows artifact build/smoke | Pass | Host shell builds |
| Windows Playwright | Not locally runnable without Chromium; GitHub job is red | Install browser and repair startup-consent scenario handling |
| Neural EN→NE formal | chrF 0.4468 vs 0.55 floor | Fail |
| Neural EN→NE informal | chrF 0.4440 vs 0.50 floor | Fail |
| Neural NE→EN Devanagari | chrF 0.6111 | Pass |
| Neural NE→EN romanized | chrF 0.4248 | Pass |

Current failed-run links:

- Commit: <https://github.com/maxwellabgit/nepaliTranslation/commit/71c85df5a4a7ba238c3496ed243ea0b25b027d91>
- JavaScript/Playwright run: <https://github.com/maxwellabgit/nepaliTranslation/actions/runs/35744912046>
- Supabase run: <https://github.com/maxwellabgit/nepaliTranslation/actions/runs/35744912134>

## Rules for the final implementation pass

Give the following rules to the implementing AI before any edits:

1. Start from a clean, freshly fetched `origin/main`. Record the exact base SHA in the PR and test artifact.
2. Implement one remediation lane per branch and PR. Never combine model work, database work, mobile UI work, and release operations in one unreviewable change.
3. Do not rewrite already-applied Supabase migrations. Add forward-only repair migrations so deployed and fresh databases converge to the same schema and behavior.
4. A test that currently exposes a real defect must be fixed at the implementation boundary, not deleted, skipped, weakened, or converted to a snapshot.
5. No release claim may use a commit message as proof. Attach command output, test results, database assertions, screenshots/device recordings, and exact build identifiers.
6. All network-dependent features fail closed and leave offline translation usable.
7. All remote flags default off in a new production database and after a failed flag fetch.
8. TestFlight uses Google test ad units. Never generate live AdMob revenue from an internal beta tester.
9. Do not lower the frozen neural-model thresholds to make the certificate green.
10. Every error shown to a user must be actionable and localized in English and Nepali; raw SQL, Supabase, RevenueCat, AdMob, or stack errors stay in scrubbed diagnostics only.

## Ordered finalization lanes

The lanes below are ordered by dependency. Merge each only after its exit gate is met, update `main`, then branch the next dependent lane from the new tip.

### R0 — Restore an honest release baseline

**Suggested branch:** `cursor/v1-r0-release-baseline`

1. Create a new active plan that supersedes stale G0–G5 completion claims. Link this runbook and list R0–R9 as incomplete gates.
2. Fix `mobile/src/features/ads/__tests__/AdService.voidLoadContract-test.ts` without removing its behavioral assertions. Jest hoists `jest.mock` factories; do not declare the typed callback parameter inside the factory in a way Babel treats as an out-of-scope identifier. Move reusable types/helpers outside the factory or use explicitly mock-prefixed variables supported by the transformer.
3. Run the full mobile gate from a clean install. Confirm the test does not merely pass alone but also passes in `verify:ci`.
4. Install Playwright Chromium in the test environment and reproduce the red scenario locally. Update the common scenario bootstrap to accept the startup gate deliberately. A test may bypass it only through an explicit fixture named to make the bypass visible.
5. Inspect the first failing Supabase CI step and capture its full error before editing. Repair the root cause through the R1 forward migration; do not mark the workflow optional.
6. Replace stale release documentation:
   - remove claims that public benchmarks are excluded from review when the frozen contract says they are initially eligible;
   - describe the global 10-item window, not per-user exclusive assignments;
   - state that raw speech is required for full V1, not deferred;
   - state 1 credit = 15 minutes everywhere;
   - distinguish “implemented” from “deployed and proven.”
7. Correct iOS camera purpose text in `mobile/app.json`. It currently promises that photos stay on-device, which conflicts with the consented contribution path. Use language equivalent to: “NepTranslate uses the camera to translate Nepali and English text. Images stay on this device unless you sign in and explicitly enable contributions.” Apply equivalent text to the Expo camera plugin entry.
8. Add build provenance exposed in a diagnostic screen and logs: Git SHA, marketing version, iOS build number, release environment, model manifest version/hash, and feature-flag snapshot. Do not display secrets.
9. Change marketing version from `1.6.2` to `1.7.0`. Configure build numbers so every App Store upload is unique; the recommended mechanism appears in the TestFlight section.
10. Add a dedicated `testflight` EAS profile using store distribution, preview/staging environment, automatic build-number increment, pinned Expo SDK 57 build image, and test ads.

**R0 exit gate**

- Clean checkout: `npm ci && npm run verify:ci` passes in `mobile`.
- `npm ci && npm run build && npm run test` passes in `admin`.
- `npm ci && npx playwright install chromium && npm run build && npm run test:scenarios` passes in `testing-ground` for the repaired baseline scenarios.
- JavaScript, admin, secret-scan, model-hash, and repaired Playwright checks are green on the branch. If the only remaining red check is the already-reproduced Supabase defect owned by R1, label R0 `PASS (stacked; merge after R1)` and stack R1 on R0. Do not create a TestFlight build until R1 also makes the full commit green.
- Generated public Expo config shows test ad IDs for `testflight`, correct legal URLs, `supportsTablet: true`, version `1.7.0`, and no secrets.

### R1 — Repair review rewards and 5 PM rotation

**Suggested branch:** `cursor/v1-r1-review-ledger-rotation`

Create a new forward-only repair migration. Do not alter `20260922100000_g1_public_review_pool.sql` or `20260922100500_g1_credit_ratio_15_minutes.sql` after they may have been deployed.

1. Repair reward idempotency so every lookup and conflict target uses the actual identity `(user_id, source_type, source_id)`. Two different users must be able to receive a reward for the same globally reviewed source item.
2. Make `private.apply_reward` the only function that mutates both the immutable reward ledger and the user's `earned_entitlements`. Direct inserts into `reward_ledger` are prohibited.
3. During window close, call `private.apply_reward` once for each eligible submission and mark the submission granted only after the function returns an applied-or-already-applied result.
4. Store the exact awarded credit count and minutes on the submission/grant event. Use 1 credit/15 minutes for the bottom half by frozen source word count and 2 credits/30 minutes for the top half. Define the tie rule deterministically: order by `source_word_count DESC, source_item_id ASC`; the first `ceil(window_item_count / 2)` items are worth 2 credits.
5. Add an explicit `eligible_for_reward` or equivalent derived status. Only `confirm` and `edit` qualify automatically. `skip` earns zero and keeps the source eligible to requeue; `report` earns zero and quarantines the source pending admin action.
6. Add an advisory transaction lock for rotation. One invocation owns the New York close operation; concurrent invocations return the already-produced window/result.
7. Add `p_as_of timestamptz default now()` to the internal/service rotation implementation. Production calls use the default; tests inject boundary times.
8. If an open window exists and its stored `ny_close_at` is later than `p_as_of`, return a structured `not_due` result without mutation or error.
9. At or after the due time, close once, award once, finalize item retirement/quarantine, and preselect the next window. Use a stable New York local-date/window key with a uniqueness constraint.
10. If no window exists, create the current appropriate window without granting rewards. If fewer than 10 eligible items exist, create a window with the available count and raise an operations warning rather than duplicating items.
11. Make retries safe after interruption. A second call cannot issue another grant, close another window, or select another set for the same New York day.
12. Change `process-scheduled-jobs` so a critical rotation/deletion failure produces a non-success job status that monitoring can detect. Do not swallow `rotate_failed` inside an HTTP 200 with no alert.

**Required pgTAP/integration cases**

- 4:59:59 PM New York returns `not_due`; 5:00:00 PM closes exactly once.
- Both US DST transition weeks produce the correct UTC close time.
- Two simultaneous rotation calls produce one close and one set of grants.
- Retry after a simulated interruption is exactly-once.
- Two users can earn against the same source item.
- One-credit review extends ad-free time by exactly 15 minutes; two-credit review by 30 minutes.
- Retrying reward application does not extend again.
- `skip` and `report` do not grant; `confirm` and `edit` do.
- Pre-close unsatisfactory status prevents a grant.
- Late rejection preserves the granted entitlement and creates one contributor alert.
- Empty and under-10 pools behave deterministically.

**R1 exit gate:** fresh-database and upgrade-path Supabase tests pass locally and in GitHub, a database assertion shows the ledger row and entitlement end time advancing together, and every required GitHub check is green on the exact R0+R1 integration commit. Merge the reviewed R0 and R1 changes without squashing away their evidence, then tag that green commit as the internal diagnostic baseline.

### R2 — Build a trustworthy corpus registry, retirement, and importer

**Suggested branch:** `cursor/v1-r2-review-corpus-import`

1. Replace directory guessing with an explicit corpus registry. Each entry must declare corpus ID, purpose (`training`, `benchmark`, or `gold`), path/glob, format, language columns, provenance/license status, visibility, and content-hash algorithm.
2. Support every actual input format used by the repository—JSONL, JSON, and CSV—through a named adapter. Remove the duplicated/unreachable `eng_Latn/npi_Deva` branch.
3. Make imports fail closed on malformed records, unrecognized schema, unknown provenance/license, unsafe PII, invalid language, or a request failure. Produce a reject manifest rather than silently skipping lines.
4. Expand safety detection and allow an admin-reviewed override; never claim regex alone guarantees de-identification. At minimum detect email, phone, government/financial identifiers, obvious addresses, and high-entropy tokens, and keep the raw rejected content out of ordinary logs.
5. Add normalized source and target content hashes for global deduplication. Preserve source provenance even when multiple corpora contain the same text.
6. Remove the permanent `__probe__` database write. Use a read-only capability check or roll back a transaction used for validation.
7. Batch upserts transactionally. A failed batch makes the run fail and nonzero; it cannot be silently counted as success.
8. Populate `review_import_runs` with start/end time, Git SHA, registry version, manifest checksum, per-file seen/accepted/rejected/deduplicated counts, and final status.
9. Add `review_exclusions` (or an equivalent canonical registry) keyed by content hash and source lineage. It must record `public_reviewed`, `public_exposed_benchmark`, `reported_quarantine`, `consent_withdrawn`, and `account_deleted` reasons.
10. At daily-window close:
    - if at least one user submitted `confirm` or `edit`, retire the source from future public windows and add its hashes to training/evaluation exclusions;
    - if all interactions were skips or there were none, the source may requeue;
    - if any valid report remains unresolved, quarantine it.
11. Make every training/evaluation export join against the exclusion registry. CI must fail if an excluded hash appears in a generated training set or a future private ship evaluation.
12. Because the frozen contract permits current benchmarks in public review, mark a benchmark item public-exposed as soon as it enters a visible window. Preserve the old result only as a historical baseline, and create a new private, non-public holdout before using model quality as a ship gate again.
13. Add a dry-run command that writes a manifest but performs no database writes. Require a human to approve counts before production import.

**R2 exit gate:** the dry run accounts for every registered source file and every row; included + rejected + deduplicated equals seen; an intentional malformed row fails the run; a reviewed hash cannot re-enter review, training, or private evaluation.

### R3 — Finish the mobile Review experience and admin operations

**Suggested branch:** `cursor/v1-r3-review-product-ui`

The existing `publicReviewApi.ts` is an API beginning, not a user-facing feature. Build the complete product path.

1. Replace the old consensus-contribution surface with a concise **Review** entry point. Do not add another permanent top-level tab if an existing Learn/Settings surface can host a clear card or overlay without clutter.
2. The Review home state shows:
   - “Today’s 10” / Nepali equivalent;
   - New York close countdown with explicit timezone wording;
   - progress as `submitted / available`;
   - current ad-free balance in minutes and credits;
   - one primary “Review next” action;
   - submitted, unavailable, offline, sign-in-required, consent-required, and all-done states.
3. The item screen shows immutable source text, current target text, source language, correction field, and four explicit actions: Confirm, Submit correction, Skip, Report. Hide reward language for skip/report.
4. Require a meaningful edit before enabling Submit correction. Normalize whitespace but preserve Devanagari. Show a diff preview for edited text.
5. After submit, lock the item for that user/window, show the pending reward and expected close time, and advance to the next item. A network retry uses one client idempotency key and cannot duplicate a submission.
6. Do not imply that a reward has been earned until the close job grants it. After close, show granted credits/minutes or the pre-close rejection state. Late rejection does not change the granted display.
7. Enforce eligibility on the server, not only the client. Add `private.assert_review_eligibility(auth.uid())` and require current startup consent version, T&C, privacy, 18+ stamp, contribution consent, no pending deletion/withdrawal, and enabled text-contribution flag.
8. Remove any service-role endpoint behavior that returns review data merely because a caller is authenticated. The security-definer RPC and Edge function must bind every action to `auth.uid()` and least privilege.
9. Add a real admin area for:
   - import runs and reject manifests;
   - current/previous review window and its exact 10 items;
   - submission inspection/diff;
   - pre-close unsatisfactory marking;
   - late rejection with contributor alert;
   - report/quarantine resolution;
   - source eligibility/exclusion history;
   - reward and scheduler audit events.
10. Admin mutations require server-side role checks, a reason, actor, timestamp, before/after state, and an append-only audit entry.

**R3 exit gate:** automated mobile and admin tests cover every state; a signed-in, consented test user can submit all actions; an ineligible user receives no items; an admin can adjudicate; the close event appears correctly in both user and admin views.

### R4 — Correct consent, withdrawal, deletion, and raw media

**Suggested branch:** `cursor/v1-r4-consent-media-deletion`

1. Repair `service_record_startup_consent`. Do not accept an arbitrary writable user ID from an authenticated caller. Derive the subject from `auth.uid()` or reject when `p_user_id <> auth.uid()`.
2. Add the English/Nepali selector directly to first-launch consent. Terms and Privacy links must resolve before Continue is enabled in an external build. An internal diagnostic build may use clearly labeled staging legal pages, never blank links.
3. Keep startup acceptance local for guest use, then mirror the current consent version to the profile immediately after later sign-in. Add an auth-session observer and an idempotent server write.
4. Block optional telemetry, ads, contribution uploads, and background network lifecycle work until the appropriate consent/flag gates have resolved. Core offline translation may initialize.
5. Define version handling: the app has a bundled minimum version; the server may require a newer active version; a version increase reopens the gate before optional processing resumes.
6. Add a separate **Withdraw contribution consent** action that preserves the account. On confirmation:
   - stop new uploads immediately;
   - cancel and securely remove queued local media;
   - create an admin alert and 30-day purge deadline;
   - show status and cancellation policy to the user;
   - delete all linked raw media, text submissions, review submissions, derived artifacts, and content lineage by the deadline.
7. Account deletion uses the same linked-data purge, then deletes authentication/account data. Do not retain accepted reports or derived contributions merely by nulling the user ID if the promise says linked data is deleted. If legal counsel later approves irreversibly anonymized aggregates, specify them separately; do not infer that exception in code.
8. Map every linked table, storage bucket, derived export, queue, and audit reference in a machine-readable deletion manifest. The job records deletion proof without retaining the deleted content.
9. Finish raw-speech contribution end to end:
   - capture the actual audio used for speech translation;
   - copy it to a durable app-owned file before the temporary recorder path disappears;
   - attach language, duration, codec, model/transcript metadata, consent version, and content hash;
   - enforce size/duration limits;
   - queue offline and retry idempotently;
   - delete the local copy after verified upload or consent withdrawal;
   - handle permission denial, interruption, backgrounding, disk full, sign-out, and account switch.
10. Apply the same consent/version/user-binding controls to photo contributions. Camera translation remains available without contribution.

**R4 exit gate:** server authorization tests prevent cross-user consent writes; guest-to-signed-in consent mirrors correctly; withdrawal stops uploads immediately; a time-advanced 30-day test deletes every linked row/object; physical-device audio and photo evidence proves real files—not fixture URIs—reach private storage only after consent.

### R5 — Complete ads and subscriptions without harming translation

**Suggested branch:** `cursor/v1-r5-monetization-device-proof`

1. Preserve the G3 listener-before-load and confirmed-impression logic. Add bounded timeouts and listener cleanup so a missing native callback cannot leave an unresolved promise or duplicate listener.
2. Add safe interstitial opportunities after:
   - the user clears/dismisses a completed translation result;
   - the user completes and leaves a lesson;
   - an equivalent explicit idle boundary.
   Never cover a translation being read, active speech, camera capture, consent, paywall, sign-in, or a correction being edited.
3. Count only foreground-active time. Background/suspended time does not advance 15 minutes. Reset the timer and increment the New York-day cap only after a confirmed impression.
4. If the device is offline, the network-ad path performs no request. The app may show a small local premium card only at the same safe opportunity; it must be dismissible and must not mimic an ad impression.
5. Keep all ads suppressed while earned entitlement is positive or the RevenueCat ad-free entitlement is active. Verify entitlement selection after account switch and sign-out so one user's subscription does not leak to another.
6. Add UMP/privacy consent and child-directed/content-rating configuration appropriate to an adults-only contribution feature while translation itself remains generally usable. Have counsel review final regional requirements.
7. Rewarded ads must use server-side verification, a one-time opaque session, signature verification, and exactly-once `apply_reward`. Client callbacks alone never grant credit.
8. In RevenueCat sandbox, prove buy, restore, active renewal, cancel, billing retry, refund/revoke, reinstall, second device, sign-out, and account switch. The server webhook and client refresh must converge on the same entitlement.
9. Configure the App Store subscription product, localization, review screenshot, price, tax/banking agreements, and RevenueCat offering before enabling `paywall_enabled`.
10. Internal TestFlight always uses test ad units. Live ad IDs are permitted only in an explicitly reviewed App Store production build.

**R5 exit gate:** physical-device logs prove the 15-minute timer, safe opportunity, daily cap, earned-credit suppression, subscription suppression, offline behavior, SSV exactly-once, and account isolation. Logs contain no captured speech/photo/text.

### R6 — Repair and certify model quality

**Suggested branch:** `cursor/v1-r6-model-ship`

1. Keep the current failed certificate as evidence. Do not overwrite or relabel it as a pass.
2. Create a new private holdout before exposing more benchmark items through public review. Deduplicate it against training, synthetic, public-review, and correction data by normalized content hash.
3. Reproduce the exact failures with tokenizer, source/target language tags, decoder prefix, formal/informal control, punctuation, and runtime ONNX parity diagnostics.
4. Fix the register failure at the model/data/decoding boundary. A deterministic postprocessor is acceptable only for linguistically general rules that pass adversarial tests; it may not key on gold sentences.
5. If fine-tuning is required, use licensed/provenanced data, record dataset hashes and training configuration, export deterministic INT8 ONNX assets, update the pinned manifest, and rerun runtime parity.
6. Rerun all four frozen classes on a clean machine and physical iOS devices. Validate output quality, latency, memory, thermal behavior, first-run load, and app size.
7. Until this lane passes, keep the failed neural English→Nepali path behind an experimental flag and route the public internal build to the tested phrase/lexicon fallback where coverage exists. Never describe the fallback as full neural translation.

**R6 exit gate:** every frozen class meets its existing floor on the new private holdout; formal/informal register metrics pass; no threshold was lowered; the exact bundled hashes match the certified files; iPhone and iPad evidence is attached.

### R7 — Polish mobile/iPad UI and the Windows testing ground

**Suggested branch:** `cursor/v1-r7-ui-testing-ground`

#### Mobile and iPad polish

1. Use one clear primary task per screen. Remove explanatory paragraphs that repeat labels or can be moved to contextual help.
2. Preserve the simplified Translate experience:
   - empty state: centered bilingual Speak button, concise source/target selector, credits gauge;
   - active two-person state: current-turn control at bottom, transcript above, current language obvious;
   - Camera: portrait capture, sentence-aligned colored highlights, translation in a collapsible dark translucent sheet under the image;
   - Learn and Review: progressive disclosure rather than dense dashboards.
3. Use consistent navigation, spacing, typography, corner radius, shadows, icons, loading skeletons, empty states, error states, and haptics. Respect Dynamic Type, Reduce Motion, VoiceOver, color contrast, and 44-point touch targets.
4. Test long English and Nepali strings, large accessibility text, dark/light mode, landscape iPad where supported, split view, keyboard appearance, notches, home indicator, and older/smaller iPhones.
5. Never rely on color alone for sentence correspondence; pair highlight colors with numbered/lettered markers and accessible labels.
6. Make all permissions just-in-time. If mic/camera permission is denied, retain typed translation and show one concise route to Settings.
7. Make account, contribution consent, credit history, subscription, language, privacy, and deletion status discoverable in Settings without mixing them into the core translation screen.

#### Windows testing ground

1. Keep the left side as the real Expo web app in a phone frame. Do not create a second imitation UI.
2. Replace cluttered diagnostics with six text-first panels: Release Snapshot, Scenario, Timeline, State, Fixtures, and Network/Audit. No decorative charts.
3. Display exact Git SHA/build, model method/hash, auth user, startup/contribution consent, remote flags, review window and close time, submissions, entitlement before/after, ad decision/reason, scheduler result, outbox/media state, and fallback/error reason.
4. Add deterministic fixtures for time, New York timezone/DST, user/auth, consent, review pool, reward ledger, RevenueCat, ad lifecycle, network offline/failure, camera OCR, speech transcript/audio metadata, and backend responses.
5. Every automated scenario starts with an isolated profile and finishes by writing an artifact bundle: scenario config, events JSONL, state snapshots, screenshot set, test result, Git SHA, and secret-scan result.
6. Implement at least these end-to-end scenarios:
   - startup consent in English and Nepali;
   - offline typed translation and fallback;
   - speech turn and camera result UI;
   - global review list, confirm/edit/skip/report, duplicate retry;
   - 4:59 to 5:00 PM rotation, reward grant, and no double grant;
   - pre-close rejection and late rejection;
   - consent withdrawal and 30-day deletion;
   - 15 foreground minutes followed by a safe interstitial opportunity;
   - rewarded SSV replay rejection;
   - purchase/restore sign-in guard and account switching;
   - optional-service failure while core translation remains usable.
7. Label Windows-only limitations prominently: it cannot prove native mic/camera permissions, AdMob rendering, StoreKit/RevenueCat purchase sheets, ONNX native parity, or iOS background/interruption behavior.

**R7 exit gate:** all deterministic scenarios pass in CI and write inspectable artifacts; UI review has no critical accessibility/layout issues; native-only gaps are covered in R9 device tests.

### R8 — Deploy and prove backend operations

**Suggested branch:** `cursor/v1-r8-production-ops`

This is an operational gate, not only a documentation gate.

1. Create separate staging and production Supabase projects/configurations if they do not already exist. The internal TestFlight build should target staging until destructive/reward jobs are proven.
2. Apply migrations first to a disposable fresh database and an upgrade clone. Run all pgTAP tests and schema diff. Then deploy staging.
3. Deploy every required Edge function with the correct import maps/runtime lock. Set secrets in the host, never in EAS public variables or Git.
4. Run the review importer in dry-run mode; approve its complete manifest; import to staging; verify counts and exclusions; only then import production.
5. Configure the hosted scheduler to call `process-scheduled-jobs` every minute with an authenticated secret. Prove `not_due` calls are quiet and the 5 PM close emits exactly one success.
6. Enable backups/PITR, storage policies, rate limits, budget alarms, Edge function logs, error tracking, and alerts for missed review close, reward lag, importer failure, media queue growth, deletion deadline breach, webhook failure, and feature-flag fetch failure.
7. Publish real HTTPS Terms, Privacy, and deletion/help URLs. Ensure the policy accurately describes raw speech/photos, automatic upload after consent, indefinite-until-withdrawal retention, 30-day deletion, analytics, advertising, processors, and contact details. Obtain legal review before external beta/public release.
8. Rehearse a rollback: flags off first, then app/backend rollback. A rollback must not restore deleted user content or double-issue rewards.
9. Capture a signed release snapshot: deployed migration list, function hashes, scheduler configuration, flags, legal URL checks, backup state, alerts, Git SHA, and operator/time.

**R8 exit gate:** staging survives a full accelerated New York day, scheduler and deletion jobs are observed in hosted logs, alerts are tested, production flags remain off, and an operator can execute the rollback runbook.

### R9 — Produce the release candidate and device proof

**Suggested branch:** `release/1.7.0-rc1`

1. Branch only from green `main` after R0–R8.
2. Freeze dependencies and model manifest. Do not add features in the release branch.
3. Run all repository verification commands from a fresh checkout.
4. Build a `testflight` profile with test ads and staging services. Install it on at least one small/older supported iPhone, one current iPhone, and one iPad.
5. Execute the device matrix later in this document. Record the build number and exact Git SHA in every artifact.
6. Fix release-blocking defects in focused branches, merge to main, and create a new RC/build number. Never rebuild a changed working tree under the same evidence label.
7. After subsystem proof, point a new RC at production services while keeping flags off. Smoke test core, then enable one subsystem at a time for internal accounts.
8. Run at least seven consecutive New York rotations in staging/internal use with no duplicate grant, missed close, deletion SLA issue, or unexplained contributor-data loss before external testing.
9. External V1 go/no-go requires all hard gates in the final checklist, including model certification.

## Dedicated internal-TestFlight configuration

Before building, modify `mobile/eas.json` so internal TestFlight is not accidentally treated as a live-ad production build. Preserve existing project/account details and add the equivalent of:

```json
{
  "cli": {
    "version": ">= 16.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "testflight": {
      "distribution": "store",
      "environment": "preview",
      "autoIncrement": true,
      "ios": {
        "image": "sdk-57",
        "resourceClass": "m-medium"
      },
      "env": {
        "EAS_BUILD_NO_EXPO_GO_WARNING": "true",
        "EXPO_PUBLIC_ADS_ENV": "test",
        "EXPO_PUBLIC_RELEASE_CHANNEL": "testflight-internal"
      }
    }
  },
  "submit": {
    "testflight": {
      "ios": {
        "ascAppId": "6792574384",
        "appleTeamId": "BSQ5SYHX54",
        "bundleIdentifier": "com.neptranslate.app"
      }
    }
  }
}
```

In `mobile/app.config.js`, make the explicit ads environment authoritative:

1. Accept only `EXPO_PUBLIC_ADS_ENV=test|live`.
2. If it is `test`, always use Google's official test unit IDs, even though the build uses store distribution.
3. If it is `live`, require the platform's production app/unit IDs and fail configuration when missing.
4. Never infer live ads solely from `EAS_BUILD_PROFILE=production` or store distribution.

Use EAS environment variables for non-secret client configuration. Public Expo variables are embedded in the app and must never contain service-role keys, cron secrets, RevenueCat webhook secrets, AdMob SSV secrets, or Apple credentials.

For the first internal build, target staging and set this remote flag snapshot:

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
| `telemetry_enabled` | false until policy/sink proof |
| `deletion_processing_enabled` | false until hosted deletion proof |
| `learn_enabled` | true if its existing tests pass |

The first build proves the app shell and native core. After R1–R8, enable one feature for internal test accounts at a time and preserve the previous kill-switch state for immediate rollback.

## Step-by-step: create and upload the first iOS TestFlight build

These commands assume Windows PowerShell, Git, Node/npm, and network access. Run them only after the selected build commit meets its declared gate. Do not build from an uncommitted working tree.

### 1. Confirm Apple and Expo access

1. Use an active paid Apple Developer Program account.
2. Confirm the Apple account has App Manager, Developer, or Admin access to the App Store Connect app.
3. Confirm agreements, tax, and banking do not block the app record or subscription work.
4. Confirm the Expo account can access owner `mbucholzs-team` and project ID `4d0a21e4-5c2e-45fa-b8fd-86a996abb404`.
5. In App Store Connect, verify the app record uses bundle ID `com.neptranslate.app` and note the highest iOS build number already uploaded.

### 2. Check out the exact green release commit

```powershell
git clone https://github.com/maxwellabgit/nepaliTranslation.git
cd nepaliTranslation
git checkout main
git pull --ff-only origin main
git status --short
git rev-parse HEAD
git log -1 --oneline
```

`git status --short` must print nothing. Save the SHA. If it is still `71c85df`, stop: the known blockers have not been repaired.

### 3. Run the local release gates

```powershell
cd mobile
npm ci
npm run verify:ci

cd ..\admin
npm ci
npm run build
npm run test

cd ..\testing-ground
npm ci
npx playwright install chromium
npm run build
npm run test:artifacts
npm run test:scenarios

cd ..
```

Then open the GitHub commit and wait for every required check to be green. A local pass does not override a red GitHub check.

### 4. Verify the release configuration

```powershell
cd mobile
npx expo config --type public
```

Inspect the output and confirm:

- name `NepTranslate`;
- slug/project ID/owner are correct;
- bundle ID `com.neptranslate.app`;
- `supportsTablet` is true;
- marketing version is `1.7.0`;
- camera and microphone purpose strings are accurate;
- non-exempt encryption is false only if that remains factually correct;
- release channel is internal TestFlight;
- ads environment is `test`;
- no secret value is exposed.

### 5. Authenticate EAS and initialize remote versioning

```powershell
npx eas-cli@latest login
npx eas-cli@latest whoami
npx eas-cli@latest project:info
```

If the project has not yet switched to remote app versions, run this once:

```powershell
npx eas-cli@latest build:version:set
```

Choose iOS and set the remote current build number to the **highest number already present in App Store Connect**. If 34 is truly the latest uploaded/current number, initialize remote state to 34; the `autoIncrement` testflight build should become 35. Never reuse a number already uploaded for version 1.7.0.

### 6. Configure the preview/TestFlight environment

List existing variables:

```powershell
npx eas-cli@latest env:list --environment preview
```

Create or correct the staging Supabase client URL/anon key, legal URLs, and other explicitly public client configuration through EAS environment management. Set `EXPO_PUBLIC_ADS_ENV=test`. Do not place server secrets in EAS public variables.

Re-run the public Expo config under the TestFlight profile/environment and confirm that Google's test ad identifiers—not live identifiers—will be embedded.

### 7. Build the `.ipa`

```powershell
npx eas-cli@latest build --platform ios --profile testflight
```

When prompted:

1. Log in to Apple through the supported EAS flow.
2. Let EAS use/create the distribution certificate and provisioning profile for the correct team unless your organization deliberately manages them manually.
3. Confirm the printed bundle ID, project, profile, marketing version, and build number before approving.

Do not use `--clear-cache` routinely. Use it only after diagnosing a stale-cache failure. During the build, verify the pinned model download completes and hash verification passes. After completion, record the EAS build URL, build ID, build number, Git SHA, profile, environment, artifact size, and model manifest hash.

### 8. Submit the latest successful build

```powershell
npx eas-cli@latest submit --platform ios --profile testflight --latest
```

Use an App Store Connect API key when available for reproducible CI submission; otherwise complete the interactive Apple authentication flow. Confirm submission targets App Store Connect app `6792574384`.

Do not use the one-command `npx testflight` shortcut until the repository's production/testflight profile and ads-environment inference are repaired. In the audited configuration, that shortcut selects the production profile and can conflict with the required test-ad build.

### 9. Finish setup in App Store Connect

1. Open **App Store Connect → My Apps → NepTranslate → TestFlight**.
2. Wait for Apple processing. Resolve any missing compliance prompt; the app currently declares `ITSAppUsesNonExemptEncryption=false`, which must remain truthful.
3. Open the processed build and add concise **What to Test** notes:
   - bilingual startup and UI language switching;
   - typed, speech, and Camera translation;
   - offline behavior;
   - iPhone/iPad layout;
   - known disabled features for this diagnostic build.
4. Add a feedback email and beta-app description.
5. Add the build to an **Internal Testing** group. Internal testers must be App Store Connect users. Add the owner first.
6. On iPhone/iPad, install Apple's TestFlight app, accept the invitation, install the build, and verify the diagnostics page shows the expected SHA/build/environment.

Internal testing does not require the external-beta review. When inviting people who are not App Store Connect users, create an External Testing group, complete beta review information, and submit the first external build to Apple's Beta App Review.

## Immediate iPhone/iPad test script

Run each case from a clean install and then again as an upgrade over the prior build. Record device, iOS/iPadOS version, build number, network state, outcome, screenshot/video, and diagnostic artifact ID.

### Core diagnostic build

1. **First launch:** gate appears before optional processing; switch EN ↔ नेपाली; open both legal links; accept; relaunch and confirm it does not loop.
2. **Guest translation:** translate short and long English/Nepali in both directions; verify formal/informal and Devanagari/romanized controls; confirm method label honestly reports neural vs fallback.
3. **Offline:** enable Airplane Mode before launch; typed/basic translation and navigation work; no ad, analytics, contribution, or retry storm occurs.
4. **Speech:** deny microphone, recover; then allow it; test interruption, backgrounding, silence, rapid turn changes, and English/Nepali speech.
5. **Camera:** deny/allow camera; portrait capture; rotate device; retake; collapse/expand translation sheet; verify paired markers/highlights and accessible labels.
6. **Two-person flow:** complete one turn in each language and return to the English turn; verify the active control remains reachable above the home indicator and all visible copy matches the current UI language.
7. **Learn:** finish one lesson, leave/re-enter, change language, relaunch, and verify progress.
8. **iPad:** portrait/landscape and split view, keyboard, Dynamic Type, VoiceOver, dark/light mode, and no stretched phone-only layout.
9. **Stability:** 30-minute mixed session, repeated foreground/background, low-power mode, offline/online transition, and device restart.
10. **Privacy:** inspect the staging backend and logs; with flags off, no speech, photo, translation text, ad, purchase, or review payload should leave the device.

### Feature-enable matrix after subsystem certification

Enable only one row at a time for internal accounts:

1. Auth and startup-consent mirroring.
2. Text Review with zero/controlled test reward, then real 15-minute unit.
3. Hosted 5 PM rotation and admin adjudication.
4. Speech contribution, then photo contribution.
5. Telemetry with scrubber/log inspection.
6. Test banners/interstitial/rewarded ads.
7. RevenueCat sandbox paywall/purchase/restore.
8. Deletion processing on seeded disposable accounts.

After every row, turn it off remotely and prove the app returns to core translation without rebuild.

## External V1 go/no-go checklist

All boxes are mandatory before describing the app as production V1 or inviting external testers at scale.

- [ ] Required GitHub checks green on the exact submitted SHA.
- [ ] Fresh-install and upgrade database tests pass.
- [ ] Reward ledger, entitlement extension, rotation, DST, concurrency, and idempotency proven.
- [ ] Global reviewed-item retirement and training/evaluation exclusions proven.
- [ ] Import manifest accounts for all intended corpora with provenance and safety handling.
- [ ] Mobile Review and admin adjudication are complete and accessible.
- [ ] Startup consent cannot be written cross-user and mirrors after sign-in.
- [ ] Consent withdrawal and account deletion remove all linked data within 30 days.
- [ ] Real speech/photo capture and private uploads proven on physical devices.
- [ ] Ads pass safe-opportunity, foreground timer, daily cap, offline, consent, and SSV tests.
- [ ] RevenueCat purchase/restore/refund/reinstall/account-switch matrix passes.
- [ ] Neural model meets frozen thresholds on a private, uncontaminated holdout and on-device parity passes.
- [ ] iPhone and iPad accessibility/layout/performance matrix passes.
- [ ] Legal pages, App Privacy answers, age rating, export compliance, subscription metadata, and support contact are complete and accurate.
- [ ] Hosted cron, secrets, backups/PITR, alerts, and rollback have been exercised.
- [ ] TestFlight uses test ads; the later App Store release uses live IDs only after explicit production review.
- [ ] Seven consecutive internal New York review rotations run without a duplicate/missed grant or deletion-SLA failure.
- [ ] Release owner signs the evidence bundle and records the exact App Store build number.

## Stop-ship conditions

Stop submission or disable the affected remote flag immediately if any of these occurs:

- core translation requires network or fails offline;
- captured text, speech, or photo leaves the device without the required consent;
- a user can alter another user's consent, reward, review, or deletion state;
- rewards double-grant, fail to extend entitlement, or are clawed back;
- reviewed/publicly exposed content returns to training, evaluation, or re-review;
- the scheduler misses or duplicates the 5 PM close;
- deletion passes its 30-day deadline or leaves linked media/data;
- live ads appear in TestFlight;
- an interstitial covers an active result/capture/correction;
- purchase/restore can occur as a guest or an entitlement leaks across accounts;
- the exact submitted SHA differs from the tested SHA;
- English→Nepali neural translation remains below the frozen V1 quality floor while being presented as the certified default.

## Final handoff format for the implementing AI

At the end of each lane, return exactly:

1. branch, PR, base SHA, and tip SHA;
2. concise list of changed files and behavioral changes;
3. every command run and exit status;
4. test counts and links to CI;
5. database migration/version and upgrade/fresh proof where applicable;
6. screenshots/device videos/artifact locations where applicable;
7. remaining risks and disabled flags;
8. an explicit `PASS` or `BLOCKED` against that lane's exit gate;
9. no claim that a later lane is complete merely because scaffolding exists.

The first useful milestone is a green R0+R1, test-ad, all-optional-flags-off internal TestFlight build. The production milestone is the same tested app with each subsystem separately proven and the frozen model certificate passing.
