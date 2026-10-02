# v1-final-contract-reconciliation: Finish Bola's functional V1

## Goal
Complete polished startup, native translation UX, real monetization, and lightweight consented Today’s 10/speech/typed-feedback capture through retrievable data. Current owner-approved steps are **1 contract reconciliation** and **2 native screenshot baseline/design proposals**. The owner additionally authorized an internal TestFlight screenshot build on 2026-10-01 so the physical-device references can be supplied. Public production deployment remains gated.

## Context (paths, commands, constraints)
- Code baseline: `9aaf493`; required branch: `cursor/v1-final-contract-reconciliation-5907`, fast-forwarded from `4797385`. No push to main.
- Authority: [INTENT](../../.governance/INTENT.md), [decisions](../../.governance/V1_G0_DECISIONS.md), [AGENTS](../../AGENTS.md), [DONE](../../.agent/DONE.md).
- Prior plan/evidence: [immutable snapshot](../../docs/history/2026-10-01-contract/v1-final-contract-reconciliation.md); F/G/R programs are historical.
- Current evidence: [ten-objective validation](../../docs/TEN_OBJECTIVE_VALIDATION.md). Old CI/device/hosted results do not certify this SHA.
- Scope: EN↔NE iOS/iPadOS, SDK 57, offline core. No model improvement, gold edits, live flags, legal approval, or production deployment in steps 1–2.
- One coherent gate per commit. C0 is committed; C1 screenshot/design preparation remains gated by actual native screenshots. A separate C13 preflight slice fixes existing Camera lint blockers for the explicitly authorized diagnostic binary; it does not close C13 or waive public release gates.
- Preserve historical migrations, ledger balances, raw evidence and benchmarks. Runtime retirement requires separate verified gates; do not delete a scheduler shared with deletion.

## Done when
- Each applicable gate below has exact-SHA tests, independent review and evidence. Code-owned finalization is not hosted/device/App Store completion.
- Mobile changes: install, lint, typecheck, unit/integration, verify:translate, model pins, usage strings, Expo Doctor, coverage and web export via verify:ci.
- Backend changes: fresh and upgraded migration paths, SQL lint/pgTAP and Deno tests; CI may provide proof where local Docker/Deno is unavailable.
- Admin changes: unit/type/build plus authorization and real retrieval/export tests.
- All screenshot proposals derive from the current physical iPhone 16 build, each from a separate image agent; source/proposal absolute paths and owner review recorded.
- Public submission additionally requires native iPhone+iPad, hosted production, legal/store/ads/IAP, and existing release stop-ship gates. October 2 morning is a conditional submission target, never proof of approval.

## Milestones
Historical C0/C1 completion is not carried forward as completion of changed requirements.
- [x] **C0** Reconcile living contract, capture code baseline and inventory pivoted runtime paths. Docs-only validation and fresh independent review PASS.
- [ ] **C1** Physical iPhone 16 screenshots and owner-reviewed proposals; one agent per image; no guessed layouts.
- [ ] **C2** Bundled sample rights and standardized private contribution records; exposure/export exclusions.
- [ ] **C3** Offline local Today's 10 category/day/Extra 10 progress, no repeated samples; strict >90% delivery once; no global pool/lookahead.
- [ ] **C4** Persistent installation/date credits, restart-safe flight, 12-hour stacking and gauge; no review grant path.
- [ ] **C5** Gamified Today’s 10 actual response capture and one authorized admin retrieval/export workflow.
- [ ] **C6** Approved bilingual startup/policy and separate contribution opt-in; sign-in/18+/flag enforcement without repeated prompts.
- [ ] **C7** Session inactivity/account isolation and guest core recovery.
- [ ] **C8** Seamless typed/speech thumbs, linked source/result/audio, revision-safe outbox, actual ≤60-second files and bounded non-lossy queue; no photos.
- [ ] **C9** Withdrawal/account deletion, durable idempotent retries and hosted ≤30-day deadline.
- [ ] **C10** Owner-unit rewarded SSV, storefront pricing, RevenueCat purchase/restore/suppression.
- [ ] **C11** Banners/rotation, ten-minute foreground ads at safe points, retained approved clock reset, native serving/consent.
- [ ] **C12** Remove proven-unused runtime connections and misleading copy; dependencies, telemetry, secrets, source/install-size evidence.
- [ ] **C13** Offline core, native Camera/speech/clipboard/gestures, iPhone/iPad UX, accessibility; preserve existing model evidence.
- [ ] **C14** Fresh/upgrade databases and hosted capture→retrieval→deletion; feature flag/rollback proof.
- [ ] **C15** Full regression, exact-SHA independent review, same-code candidate device proof and owner release checklist.

## Progress
2026-10-01: inspected `9aaf493`, advanced the required reconciliation branch by fast-forward, and rewrote living documents against the owner-approved functional direction. Preserved pre-edit documents under docs/history/2026-10-01-contract. No runtime, schema, flags, or model changes.
Step 1 documents/inventory complete: eight archive snapshots match, 41 local links resolve, required plan/scope/manifest checks and final diff check pass. Fresh independent reviewer PASS; two clarity nits fixed. [Verification record](../../.agent/C0_DOCUMENTATION_REVIEW_2026-10-01.md).
Step 2: no native apps/device surface exposed by capture inventory; physical iPhone 16 screenshot provenance is missing. Requested an existing local screenshot directory. No generated proposal or design approval claimed.
2026-10-01/02 follow-up: owner requested immediate TestFlight delivery for screenshots. EAS account/project and prior build 1.7.0 (22) verified. Camera lint preflight repairs preserve current layout and capture/highlight behavior. SDK 57 patch alignment, locked install/focus patch, lint/typecheck, 466 unit tests, 19 integration tests, translation/model pins/usage strings, Expo Doctor 21/21 and fresh independent source/dependency review PASS. Full verify:ci stops at contribution/entitlement/ad coverage ratchets; no baseline lowered and C15 remains open. Proceeding only with the explicitly authorized diagnostic build. [Build evidence](../../.agent/TESTFLIGHT_SCREENSHOT_BUILD_2026-10-01.md).
2026-10-02: preflight commit ef69b2f; separate web export PASS. EAS d2b42bb1-3892-4cc4-8fc9-dc0f5b648ab8 compiled version 1.7.0 (23). Exact submission d220d753-276c-4d02-a479-a8ba0850796b failed with Apple missing/expired agreement. Owner action requested; same-build retry prepared. Automatic approval review separately rejected GitHub branch publication; candidate remains local and uploaded to EAS, not pushed to GitHub.
2026-10-02 follow-up: owner explicitly approved GitHub branch push and reported Apple sign-in complete. Existing branch push succeeded and local/remote 9cfc1a2 matched. Same-build retry 74931267 and direct submission b2055dbf failed without error details/logs. Authenticated Apple Developer page shows program license accepted; App Store Connect Business shows Free Apps Agreement Active / Paid Apps Agreement New. Actual TestFlight latest remains 22. Specific paid agreement review requested; generic upload cause remains unconfirmed. No agreement accepted, credentials rotated or public release performed.
2026-10-02 12:27 PM NY: owner reported account ready again. Same-build retry 649e8b8a reached Apple; authenticated Build Uploads shows 1.7.0 (23) Processing. EAS submission still in progress; internal tester availability pending. Source remains ef69b2f, so no rebuild or runtime change was necessary.
2026-10-02 12:32 PM NY: submission 649e8b8a FINISHED with no error. Apple processing complete: build 23 Ready to Submit / 90 days, assigned to existing internal Team (Expo), two invites. Diagnostic screenshot delivery complete; installation and actual iPhone 16 references remain owner proof. No external/public review or new UI implementation.

## Surprises & discoveries
See [pivot inventory](../../docs/V1_PIVOT_INVENTORY.md). The runtime still exposes reward copy for local samples; submitReview returns a local acknowledgement without storing corrections; thumbs are tied to a saved utterance; the interstitial controller attempts timer_elapsed presentation. These are future code work, not features certified by these docs.
page-screenshots contains older images, but no native-device/build manifest; mixed-capture images are documented browser evidence. Neither satisfies the required iPhone baseline.
The old living plan, DONE and release documents still required photo toggles, global reward windows and always-PASS validation despite the October superseding notes.

## Decision log
- 2026-10-01: owner approved steps 1–2 of the eight-step functional completion plan. Keep Today's 10 as a contribution method with local gamification, without reviving scheduled review rewards.
- 2026-10-01: native screenshots precede all new UI proposals. No browser/simulator substitution; one image agent per proposal after references exist.
- 2026-10-01: model quality is not an implementation focus; existing certification remains preserved and is not silently waived.
- 2026-10-01: runtime discrepancies are explicitly deferred to their coherent C-gates; documentation does not claim to remove or deploy code.
- 2026-10-01: explicit owner authorization permits a diagnostic TestFlight build to obtain the missing screenshots despite unfinished V1 gates. Use the existing testflight profile and Google test units, submit the exact EAS build ID, preserve all existing service flags, and record upload/processing/installation separately. No public release or new design approval is inferred.

## Commands that actually ran
- git status -sb; git merge-base --is-ancestor cursor/v1-final-contract-reconciliation-5907 HEAD: clean baseline, ancestry exit 0.
- git switch cursor/v1-final-contract-reconciliation-5907; git merge --ff-only 9aaf493: both exit 0.
- Read AGENTS, INTENT, decisions, LOOP, DONE, ExecPlan, implementation and release files.
- rg inventories over review/photo/scheduler/feedback/ad call sites: findings recorded in V1_PIVOT_INVENTORY.md.
- cua.getState(): apps=[], browser tabs=[]; no physical device capture surface.
- Node documentation validator: archive 8/8, current local links 41/41, required plan sections, no premature screenshot claim, runtime/migration/gold scope unchanged: PASS.
- First diff check identified EOF whitespace; fixed. Final git -c core.safecrlf=false diff --check: exit 0. Fresh independent reviewer: PASS, no material findings; clarity nits fixed.

## Remaining work
Deliver the authorized diagnostic TestFlight build, then native screenshot intake and separate-agent proposals; owner design review; all unproven functional gates above. The evidence record owns actual build/submission status.

## Blockers (concrete; cannot be solved from this repo)
- Physical iPhone 16 running the current app, with build/source provenance and affected screen captures. Need a supplied local screenshot folder or device-capture capability.
- Earlier Apple agreement/upload blocker superseded by successful build-23 upload, processing and internal group assignment. Physical installation/screenshot intake remains pending.
- iPad/device matrix; Apple processing; legal/bilingual sign-off; owner console/config/live-ads approvals.
- Hosted deployment and receipt collection for the October migrations/functions remain unverified.
- Existing model certificate remains unresolved, with no model work authorized in this effort.
