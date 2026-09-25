# v1-final-contract-reconciliation: Make the living product match the final V1 contract

## Goal
Reconcile NepTranslate to the final product contract on one branch, one gate at a time, starting from the newest complete integration tip. Do not build a release from `main` while it lacks the integrated R0–R9 work. Do not treat a feature on a side branch as shipped.

## Context (paths, commands, constraints)

- **Selected base:** `034f1cc66b991bf5c7ba5062bfebee7ec87f1d42` (`origin/cursor/v1-r6-r9-blockers-5907`).
- **`origin/main`:** `71c85df5a4a7ba238c3496ed243ea0b25b027d91`. `git merge-base --is-ancestor origin/main origin/cursor/v1-r6-r9-blockers-5907` exited 0 on 2026-09-23.
- **Why this tip:** After `git fetch --all --prune`, this was the newest remote commit that contains the R0–R9 integration. No other remote branch contained `034f1cc`. Older R0–R5 and G0–G5 branches are ancestors or parallel history, not a newer integration.
- **Branch:** `cursor/v1-final-contract-reconciliation-5907`, created from that tip. Local upstream was unset so pushes cannot update the R6–R9 branch by accident. Push only this reconciliation branch, and only after the gate's tests pass.
- **Working tree at selection:** clean. No user changes to preserve.
- **Progress file:** `.agent/V1_FINAL_CONTRACT_STATE.md`.
- **Loop:** `tools/run-v1-finalization-loop.ps1`. Do not run two copies.
- **Protected:** historical migrations, audit records, benchmark results, ledger history, gold references. Forward migrations only. Informal Nepali is तिमी, not तँ. On-device product path only. Expo SDK 57.
- **Do not:** deploy production, enable live ad IDs, change App Store pricing, submit a build, invent device/hosted/model/revenue proof, or `npm audit fix --force`.

### Scope that stays unless a gate explicitly changes it

Translate, Camera, and Learn are the only primary surfaces. Conversation stays inside Translate. Account is a Settings section, not a fourth tab. Account-free typed translation, Camera, local history, Settings, and Learn stay available. Offline-first behavior stays. Correct bilingual copy stays. Existing model pinning, downloader, fallback, and the honest failing model certificate stay. Existing ledger rows stay. RevenueCat identity binding and sign-in before purchase or restore stay. Impression-confirmed ad timer reset stays. Private storage and RLS principles stay.

## Done when

Code-owned C0–C15 are green on an exact pushed SHA. Fresh and upgrade database paths are green. `.agent/V1_FINAL_CONTRACT_STATE.md` is `FINALIZATION_COMPLETE` or `WAITING_HUMAN` with an exact human checklist. `FINALIZATION_COMPLETE` means code-owned work only. It does not mean App Store, AdMob, hosted production, physical devices, or public V1 were finished.

Public V1 is NO-GO while the committed English-to-Nepali model certificate fails its floors, or while any privacy, deletion, reward, provenance, export-exclusion, data-loss, auth, purchase-identity, ad-interruption, offline-core, migration, or device-support failure remains.

## Decision table

| Topic | Required value |
|-------|----------------|
| Review credits | 2 if snapshotted original source words are 0–20; 4 if 21 or more |
| Credit duration | 15 ad-free minutes |
| Rewarded ad | 2 credits after one server-verified confirmation |
| Review lookahead | Minimum 14 New York days before enablement; target 28; append every 14 days; never reshuffle planned days |
| Session inactivity | 30 days, rolling; JWT stays short |
| Interstitial cap | None. 15 minutes of foreground-active time since the last confirmed impression |
| Subscription | USD 2.99/month (US storefront); NPR 199/month (Nepal storefront). Display the StoreKit/RevenueCat localized price |

Resolved interpretations (do not reopen unless implementation evidence makes them impossible):

- First launch is bilingual legal acceptance and language choice. 18+ is the signed-in contribution gate.
- 18+ does not block the account-free core.
- Account is a labeled section inside Settings.
- Exactly two sharing toggles: speech and Camera photos. Both default off. Consent is not a third toggle.
- Toggle off stops that media type prospectively. Withdrawal starts the 30-day deletion workflow.
- Block contribution re-consent while a withdrawal purge is pending.
- Public name is “Today's 10”. Subtitle is “Review translations”. Translate both naturally in Nepali.
- Learn and Settings may link to that one route. One screen, API, submission model, and reward path.
- A local “Edit translation” may update local history only. It must not create a rewarded review.
- Confirm and edit are substantive. Skip is not. Report quarantines.
- A planned future item is private. Record export exclusions when a window opens or the item is first served, whichever is first.
- Automated V1 validation logs a real score and returns PASS. A timely human unsatisfactory decision prevents reward.
- One private planned window per New York calendar day. Windows may contain fewer than 10. Do not duplicate an item to fill ten.
- New imports get a monotonic arrival sequence and sit behind existing cohorts. Randomize within a cohort using a stored seed.
- Raw voice and face/environment photos are not anonymous. Retain a derivative after deletion only with an irreversibility certificate.
- If NPR 199 is not an Apple price point, stop and ask the owner.
- TestFlight is a no-revenue channel. An internal candidate may ship with optional server features off and known-issue notes. Public V1 may not ship while a stop-ship gate remains.

## Feature flags at the selected base

Risky and network features default off until hosted proof exists.

| Flag | Client `DEFAULT_FEATURE_FLAGS` | Database default |
|------|--------------------------------|------------------|
| `contribution_text_enabled` | off | off (`supabase/seed.sql` turns this and `contributions_enabled` on for local RPC tests only) |
| `contribution_speech_enabled` | off | off |
| `contribution_photos_enabled` | off | off |
| `rewards_enabled` | off | off |
| `network_ads_enabled` | off | off |
| `rewarded_ads_enabled` | off | off |
| `automatic_interstitial_enabled` | off | off |
| `paywall_enabled` | off | off |
| `telemetry_enabled` | off | off |
| `deletion_processing_enabled` | server-only | off |
| `learn_enabled` | bundled false; runtime forced on | core product, on |

No public-review enablement flag exists yet. Do not enable public review before 14 days of private lookahead exist.

## Milestones

- [x] **C0** Contract rebase and honest baseline
- [x] **C1** One Today's 10 route; Translate, Camera, Learn only
- [ ] **C2** Deny-by-default corpus, rights, and anonymization inventory
- [ ] **C3** 14/28-day private lookahead and `automations/` schedules
- [ ] **C4** 2/4-credit rewards and fail-closed export exclusions
- [ ] **C5** Today's 10 reviewer flow and one admin console
- [ ] **C6** First-launch legal acceptance separate from account contribution consent
- [ ] **C7** 30-day rolling authenticated session
- [ ] **C8** Account-linked speech and Camera photo uploads
- [ ] **C9** Idempotent 30-day deletion state machine
- [ ] **C10** USD 2.99 / NPR 199 copy and 2-credit rewarded ads
- [ ] **C11** Interstitial safe points; remove the daily cap
- [ ] **C12** Telemetry, privacy, dependency triage, repository hygiene
- [ ] **C13** Offline core, Camera sentence correlation, responsive UI, honest model gate
- [ ] **C14** Fresh and upgrade database proof; staging jobs when the owner provides a non-production project
- [ ] **C15** Full regression, removal pass, exact-SHA review

## C0 — Rebase the contract and establish a trustworthy baseline

Docs only, plus read-only baseline commands. Do not change product behavior.

Verification: `git status --short`, `git diff --check`, and a ripgrep inventory of `0.99`, top-50 / top half / longest, interstitial max, three-per-day, 1 credit, and 15 ad-free. The inventory is not required to be empty at C0.

Exit: living docs state the new contract; the selected base is recorded; baseline results and known failures are honest.

## C1 — Consolidate navigation and correction UX

Make Translate, Camera, and Learn the only primary surfaces. Replace every legacy Contributions destination with one route id such as `todays_review`. Wire ReviewScreen or its successor into `App.tsx` and AppShell. Learn and Settings navigate to that same route. On refresh, restore the current window, the signed-in user's submissions, completed state, selected action, edited text, and earned/pending status. Local edits must not create a rewarded review. Remove ContributionsScreen, contribution cards, and MeaningReview only after reference search proves they are unused. If a sheet remains for local editing, rename it and strip reward behavior.

Tests: route reducer; guest tap; sign-in gate; consent gate; window load; submit; relaunch; already-submitted display. Search `mobile` for `ContributionsScreen`, `MeaningReview`, `openContributions`, `contributions`, `Review translations`, and `Today's 10`.

## C2 — Corpus, provenance, rights, and anonymization

Forward migrations only. Inventory training, benchmark, collected, reviewed, and excluded sources. Canonical records include dataset id, split, provenance, license, rights (`cleared_public_display`, `admin_only`, `unresolved`, `prohibited`), public-display permission, anonymization (`not_required`, `pending`, `certified`, `failed`) with method/version, import batch, hashes, eligibility, and admin notes. Unresolved rights become `admin_only`. Collected text without certification cannot enter review. Raw media is not publicly correctable. Certification records state processor version, fields removed, re-identification assessment, reviewer, and timestamp. Importers fail closed. Reject reports stay out of version control. Remove tracked `datasets/review_import_rejects.json` if it is generated output; keep small fixtures.

## C3 — 14/28-day global lookahead

Tables or extensions: `review_selection_runs`, `review_windows`, `review_window_items`, `review_source_items`, `review_queue_events`. One transactional service with an advisory lock. Bootstrap requires 14 future days before the public-review flag; plan toward 28. Every 14 days append until the horizon is 28 New York days, using `next_due_at` rather than only a cron expression. Never modify already planned or open assignments because new data arrived. Up to 10 items; fewer is valid. No item in two planned/open windows. At close: no substantive review recycles to the back; one or more substantive reviews are terminal; report quarantines as `admin_only`. Future planned text is not readable by public or ordinary authenticated clients. Open and close with `America/New_York` in the database.

Create `automations/README.md` plus `review-lookahead`, `review-validation`, and `data-deletion` schedule files. Document source function, cadence, hosted binding, required secret names (not values), idempotency key, alert destination, manual invocation, and proof command.

Tests: DST spring-forward and fall-back, exactly one 5:00 PM New York transition, concurrent planners, 14/28 behavior, new imports do not reshuffle, no duplicates, recycle, terminal review, private future plans, partial inventory.

## C4 — Reward tiers and export exclusions

One Unicode-aware original-word-count function and rule version. Snapshot `original_source_word_count` and `scheduled_credits` (2 or 4) at assignment. Do not recompute from later edits. Reject empty sources before planning. Remove percentile logic from new paths. Historical tier fields stay, marked deprecated. Grant once with a stable key such as `review_submission:{submission_id}:window_close`. Validation logs algorithm/version, normalized hashes, cosine score, PASS, run id, and timestamp. Human unsatisfactory before close prevents reward. Late rejection alerts and leaves the ledger. On exposure, add source and target hashes to the exclusion registry. One fail-closed export library for every train and eval exporter. Manifests state exporter version, datasets, exclusion snapshot, row counts, and zero forbidden hashes. CI fails if a new exporter skips that module. Do not treat an empty exclusion file as proof.

## C5 — Today's 10 and the admin console

Mobile: current window date/time, progress count, one item at a time (source, candidate, Confirm, Edit, Skip, Report), snapshotted 2 or 4 credits, retry-safe submit, rehydrated state, reward-settlement explanation, no future windows, concise bilingual copy.

Admin: one operational view. Correct source-item versus window identifiers. Filters for current/prior window, pending validation, PASS, human unsatisfactory, late rejection, quarantine, and contributor alerts. Server-side mutations. Prominent always-PASS notice. Paging and code-splitting if needed for the >500 kB admin bundle warning.

## C6 — First launch versus account consent

First launch: English/Nepali selector before acceptance, Terms, Privacy, local acceptance, mirrored when signed in. No account and no 18+ required to finish first launch or to use guest translation. The same selector lives in Settings > General.

Settings > Account: sign-in, subscription, consent status/version, both sharing toggles, withdraw, delete account. Toggles cannot turn on without current consent and 18+. Public-review submit checks consent and 18+ on the server. Store version, `accepted_at`, policy links, age attestation, locale, and audit metadata. Material consent-version changes require re-consent.

## C7 — 30-day rolling session

Configure Supabase Auth `inactivity_timeout` to 30 days where the checked-in config supports it. Keep JWT lifetime short. Do not claim the hosted timeout is active until the plan supports it. Client guard: stale account UI must not stay authorized offline forever. On expiry, stop contribution workers, clear or quarantine that account's pending uploads, sign out locally, preserve guest data, and explain sign-in only when an account feature is used. Test with a short timeout in an isolated environment.

Consult https://supabase.com/docs/guides/auth/sessions and https://supabase.com/docs/guides/local-development/cli/config and record the version/date.

## C8 — Speech and photo contribution uploads

Prove a durable recording URI and a durable Camera photo/task record exist before enqueue. Every outbox entry has account id and consent epoch. Enqueue only when signed in, session valid, current consent accepted, 18+ attested, matching toggle on, and remote flag on. Translation/OCR never depend on upload success. Private account-scoped paths. Strip avoidable metadata without calling the bytes anonymous. Encrypt in transit. Bounded retry and idempotency keys. No media or raw text in logs. Toggle off, withdrawal, delete, sign-out, and expiry stop the correct account's workers only.

## C9 — Deletion state machine

A private deletion request survives deletion of user-owned rows: request id, kind (`consent_withdrawal` or `account_deletion`), subject, consent epoch, `requested_at`, `due_at` = requested_at + 30 days, alert time, stage, attempts, last error, `next_retry_at`, storage/database/auth completion, `completed_at`. Fix the withdrawal RPC so the due query can see the request. Alert admins on creation. A 14-day reconciler repairs missing requests and stalled stages without pushing the original deadline later. An hourly or daily executor meets the 30-day deadline. Stages are idempotent. Auth deletion happens only for account deletion, and only after storage and database completion. If auth deletion fails, keep the state record and retry. Block re-consent until a pending withdrawal purge completes.

## C10 — Subscription and rewarded ads

Replace visible and behavioral USD 0.99 with the new contract. Read the displayed price from StoreKit/RevenueCat. Document operator steps for US USD 2.99, Nepal NPR 199, RevenueCat entitlement, and agreements. Do not hard-code NPR for other storefronts. Preserve sign-in before purchase and restore. One server-verified rewarded confirmation grants exactly 2 credits, idempotent on the provider transaction id. Reject client-only claims. Count abuse throttles in two-credit units. Consult Apple's subscription pricing and availability docs and record the date.

## C11 — Interstitial safe points

Remove the per-New-York-day maximum from decisions, storage, tests, and copy. An analytics count must not gate presentation. Count foreground-active milliseconds only. At 15:00 set pending; do not present immediately. Allow only `translate_send_committed`, `camera_capture_committed`, and `learn_activity_completed`, and only after the user data is durable. Reject launch, resume, tab press, permissions, error recovery, exit, recording, unsaved edits, and transient-only input in code. Attach listeners before load/show. Reset elapsed time only after a confirmed impression. No-fill preserves pending eligibility. One presentation attempt at a time. Banners only when Translate or Learn is idle. Google test units only.

## C12 — Telemetry, privacy, dependencies, hygiene

One production telemetry adapter with a strict allowlist. Scrub translation, transcript, OCR, media, paths, email, auth ids, tokens, and secret URLs. Payload tests use sentinel secrets and Nepali/English fixtures. No ATT, tracking string, or IDFA. UMP at launch must not block offline core if it times out. Privacy options in Settings when required. Re-run `npm audit` per JavaScript workspace. Classify findings. Upgrade only inside the pinned Expo major. Never `npm audit fix --force`. High-severity reachable production issues are stop-ship until owned. Remove generated reject files and build artifacts from Git. Keep historical audit evidence and small fixtures.

## C13 — Core product and responsive UI

Startup must not wait forever on auth, ads, RevenueCat, telemetry, remote config, or review. Offline typed translation both ways, history, Learn, Settings, and language. Camera portrait guidance without breaking iPad. Stable sentence IDs and one translucent color per sentence, shared by overlay and translation below the image, plus a non-color cue. Recover image and result across background and ad attempts. Check small, standard, and large iPhone, plus one iPad, portrait and supported multitasking widths, safe areas, dynamic type, VoiceOver, reduced motion, contrast, keyboard, and Nepali font fallback. Rerun the pinned four-class ship evaluation. Do not change thresholds. A failing EN→NE certificate blocks public V1. Smoke tests are not certification.

## C14 — Hosted automation and database proof

Fresh local Supabase from zero, plus an upgrade from the integration-tip schema, plus pgTAP on both, when Docker is available. If Docker is missing, record BLOCKED rather than PASS. Staging deploy and hosted job proof require the owner's non-production project. Checked-in YAML is not hosted proof. No production deploy without owner authorization. Jobs: New York window rotation, daily validation, 14-day lookahead maintenance, 14-day deletion reconciliation, and a frequent deletion executor. Use `next_due_at` and idempotency. Verify private buckets, RLS, backup/PITR notes, and kill switches.

## C15 — Regression, removal, exact SHA

Remove legacy correction UI, percentile rewards, the daily interstitial cap, hard-coded USD 0.99, generated reject dumps, the duplicate admin review page, and vacuous exclusion checks only after reference search and tests. Preserve historical migrations, benchmark failures, ledger rows, legal audit records, and local-only edit/history.

Minimum commands are listed in the plan's regression section in the owner's brief and in `.agent/DONE.md`. Also run fresh and upgrade pgTAP when Docker exists, export fail-closed tests with seeded hashes, model ship evaluation, secret scan, iOS config validation, and `npx eas-cli config --platform ios --profile testflight` as inspection only.

Independent review against the base SHA and `origin/main`. Push the reconciliation branch only. Do not merge to `main` in this program without a reviewed PR the owner asked for.

## Test matrix

Record each area PASS, FAIL, or BLOCKED with an evidence path. “Not run” is not PASS.

Guest core; navigation; review timing including DST; lookahead; review identity and relaunch; confirm/edit/skip/report/recycle/terminal; rewards 0/20/21 plus idempotency and late reject; validation PASS with a logged score; provenance; export safety; consent; sharing toggles; session expiry; deletion; subscription; rewarded SSV; interstitial safe and forbidden points; banners; telemetry sentinels; Camera UX; responsive layout; fresh and upgrade database; four-class model certificate; Expo Doctor, native config, privacy manifest, test ad IDs.

## Human gates (do not mark done)

Hosted Supabase plan with 30-day inactivity, staging then production deploy, scheduler secrets, backup/PITR, admin alerts. App Store Connect bundle, USD 2.99, Nepal NPR 199 if offered, RevenueCat, privacy labels, legal URLs, Sign in with Apple revocation if used. AdMob readiness, app-ads.txt, UMP, live IDs only on the approved production path. Physical iPhone and iPad evidence in `docs/DEVICE_PROOF.md` without user content.

Internal TestFlight may be considered only after C0–C15 code-owned work is green, database tests are green, no unowned reachable high-severity dependency remains, the app launches on a physical iPhone, test ad units are configured, optional features without hosted proof are off, the model failure is disclosed, and the SHA is recorded. Public V1 additionally needs a passing model certificate, iPad evidence, hosted production proof, storefront pricing proof, and AdMob/UMP readiness.

Cursor may prepare TestFlight commands and must not submit without owner authorization. Merge to `main` only through reviewed PRs. Never promote test ad IDs or staging endpoints to production silently.

## Official docs to consult while implementing

Record the version or date consulted:

- Supabase sessions: https://supabase.com/docs/guides/auth/sessions
- Supabase CLI config: https://supabase.com/docs/guides/local-development/cli/config
- Apple subscription pricing: https://developer.apple.com/help/app-store-connect/manage-subscriptions/set-up-pricing-for-auto-renewable-subscriptions/
- Apple storefront availability: https://developer.apple.com/help/app-store-connect/manage-subscriptions/set-availability-for-an-auto-renewable-subscription/
- Google interstitial: https://developers.google.com/admob/ios/interstitial
- Google UMP: https://developers.google.com/admob/ios/privacy
- Expo iOS submit: https://docs.expo.dev/submit/ios/
- Expo EAS internal distribution: https://docs.expo.dev/build/internal-distribution/
- Expo SDK 57: https://docs.expo.dev/versions/v57.0.0/
- Cursor CLI: https://docs.cursor.com/en/cli/using

Where the pinned SDK differs from a current example, follow the pinned SDK.

## Handoff format when the program stops

Selected base SHA and final HEAD. Branch name and push status. Completed gates. Files added, removed, and materially changed. Migrations and rollback notes. Exact test commands and results. Model certification result. Fresh/upgrade database result. Dependency audit and accepted risks. Human blockers with the smallest next action. Internal TestFlight GO or NO-GO. Public V1 GO or NO-GO. A statement that TestFlight ads use test units and produce no revenue.

## Progress

C0 and C1 are recorded complete. Later commits added source for C2–C11, but a merge at `4797385` did not prove those gates. Internal TestFlight and public V1 stay NO-GO. The English-to-Nepali model certificate still fails its floors.

2026-09-25: PR #15 merged by fast-forward. `main` is `e0c4f4fe2841721b1708bca2f2ae8f8d2fc8af2f`, the SHA whose GitHub Actions runs already passed. Optional production flags stay off. That merge is code and local-database proof only.

2026-09-25: Staging project `jcrpxoojxixoieqqfgzo` has the 38 migrations and 16 Edge Functions. Flag defaults are off. Two temporary accounts were checked against each other inside a rolled-back transaction. The scheduler and review import are not done.

## Surprises & discoveries

- Local `main` was behind `origin/main`. The reconciliation branch was created from the integration tip, not from local `main`.
- `git switch -c` set upstream to `origin/cursor/v1-r6-r9-blockers-5907`. Upstream was unset before any commit.
- Admin production build at the base emits a chunk-size warning just over 500 kB and still exits 0. That matches the prior audit. C5 owns code-splitting if it is still present.

## Decision log

- 2026-09-23: Selected `034f1cc` because it is a descendant of `origin/main` and no newer remote branch contains that integration.
- 2026-09-23: Living contract numbers are the decision table in this file and in `.governance/V1_G0_DECISIONS.md`. Historical G0/R0 text stays in place as evidence.
- 2026-09-25: Accepted and fast-forwarded PR #15 onto `main` at `e0c4f4fe2841721b1708bca2f2ae8f8d2fc8af2f`. The production EAS profile still does not set live ads. Public review stays behind `public_review_release_approved`.
- 2026-09-25: Linked staging `jcrpxoojxixoieqqfgzo`, pushed migrations, and deployed functions. Did not enable flags, install the scheduler, or import the review pool.

## Commands that actually ran

See `.agent/V1_FINAL_CONTRACT_STATE.md` after C0 baseline completes. Ancestry checks:

```text
git fetch --all --prune
git rev-parse origin/main
# 71c85df5a4a7ba238c3496ed243ea0b25b027d91
git rev-parse origin/cursor/v1-r6-r9-blockers-5907
# 034f1cc66b991bf5c7ba5062bfebee7ec87f1d42
git merge-base --is-ancestor origin/main origin/cursor/v1-r6-r9-blockers-5907
# exit 0
```

## Remaining work

Code-owned C2–C15 are not closed by the commits on `4797385`. Fresh and upgrade database proof, device proof, hosted schedulers, and a passing English-to-Nepali certificate are still required before either release gate can move. Do not treat a clean merge as C0–C15 passed.

## Blockers (concrete; cannot be solved from this repo)

- Docker was unavailable in the previous environment for fresh/upgrade pgTAP. Re-check at C14. If still missing, record BLOCKED.
- Physical iPhone and iPad proof does not exist.
- Hosted Supabase, App Store Connect pricing, RevenueCat, AdMob, and legal URL proof do not exist.
- Committed EN→NE formal and informal model floors fail. Public V1 stays NO-GO until a real certificate passes without lowered thresholds.
- NPR 199 must be confirmed as an Apple price point by the owner before anyone configures the Nepal storefront.
