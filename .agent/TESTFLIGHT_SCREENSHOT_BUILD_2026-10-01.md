# Diagnostic TestFlight screenshot build

Owner request, 2026-10-01 America/New_York: "You will have to push to TestFlight so I can provide screenshots. Do this now and continue as far as you can after you wait for my results".

Purpose: deliver the current native UI to the owner for physical iPhone 16 baseline screenshots before design changes. This explicitly authorized internal diagnostic build does not certify C1–C15 or public V1. Current source/functionality gaps remain in the requirement ledger and pivot inventory.

## Identity and distribution
- Branch: cursor/v1-final-contract-reconciliation-5907.
- Source baseline: 9aaf493; documentation reconciliation: e27457a.
- Binary source SHA: ef69b2f0491cf495e21cfc3c54bbf27bb200fbe1, verified by EAS build metadata.
- EAS project: 4d0a21e4-5c2e-45fa-b8fd-86a996abb404, mbucholzs-team/translate.
- Bundle: com.neptranslate.app; app version: 1.7.0.
- Build/submit profile: testflight; existing preview environment / testflight-internal channel / Google test units. Configuration and hosted flags unchanged.
- EAS build ID: d2b42bb1-3892-4cc4-8fc9-dc0f5b648ab8; version/build: 1.7.0 (23); created 2026-10-02T04:02:11.870Z; FINISHED 2026-10-02T04:07:50.699Z. Native signing/compilation completed successfully.
- Initial submission: d220d753-276c-4d02-a479-a8ba0850796b; ERRORED 2026-10-02T04:08:56.138Z. Apple rejected upload: SUBMISSION_SERVICE_IOS_MISSING_REQUIRED_AGREEMENT, "A required agreement is missing or has expired. Sign the agreement on the Apple Developer Portal to resolve this error."
- After owner reported Apple sign-in complete: submit:retry created 74931267-8130-45a2-864a-53f1bd2f80a2, ERRORED 2026-10-02T04:14:21.016Z; error null / no log files. Direct exact-build submission b2055dbf-f14d-4c40-944e-278ff24f0ecd also ERRORED 2026-10-02T04:15:46.820Z, error null / no log files. Neither is claimed successful; latest failures do not identify a cause.
- Apple availability: authenticated App Store Connect TestFlight page inspected after retries; latest upload/build is 22. Build 23 absent at this check.
- Installed device/native screenshots: unverified.

## Preflight slice and evidence
No layout redesign. Camera rendering now correlates highlights by immutable flattened frame indices; capture/dispatch hooks have explicit stable dependencies; unused state value and duplicate type import warnings are removed. Expo 57.0.25→57.0.26 and Camera 57.0.5→57.0.6 align with SDK 57 requirements; matching constants/core patches follow Expo's dependencies. Native focus patch applies successfully. No model/gold/schema/flag change.

- Initial verify:beta stopped on existing Camera immutability error and four warnings.
- npm ci: PASS, 1050 packages installed; native Camera focus patch PASS. Audit reported 9 moderate / 6 high vulnerabilities; no unrelated automatic dependency upgrade applied.
- First verify:ci: lint/typecheck PASS; 106 unit suites / 466 tests PASS; 2 integration suites / 19 tests PASS; test-ad configuration 3/3 PASS; translation checks and 18 model pins PASS; iOS usage strings PASS. Expo Doctor 20/21 stopped coverage/export because two SDK patch versions were outdated.
- Final npm ci and verify:beta portion after SDK patches: PASS. Lint/typecheck, 466 unit / 19 integration / 3 test-ad checks, translation, model pins, usage descriptions, and Expo Doctor 21/21 all passed.
- verify:ci: FAIL at the coverage ratchet in unchanged contribution/entitlement/ad source groups. Contribution statements/branches 83.06/72.27 versus 84.59/79.34; entitlements statements/branches/lines 88.57/82.58/90.31 versus 89.52/83.89/91.33; ads 81.64/72.45/84.76 versus 84.90/73.90/87.56. Absolute 80% line / 70% branch floors pass. No baseline lowered; C15 remains open. Separate npm run export:web: PASS, 752 modules / 27 assets, exported dist.
- Fresh independent reviewer: final Camera/config/dependency review PASS, no material findings. Native compilation and capture cancellation remain separate proof.
- git diff --check: PASS before final documentation update.

## Delivery observations
- Refreshed GitHub: origin/main remains 9aaf493, included in this candidate.
- Initial separate GitHub branch push was rejected by automatic approval review. Owner subsequently explicitly approved "Yes—push the existing branch". Push to cursor/v1-final-contract-reconciliation-5907 succeeded, and local/remote HEAD both verified as 9cfc1a257a4ad833a23d67be9380fda0ca77706c before this follow-up evidence edit. Main unchanged.
- EAS build accepted existing local provisioning validation despite a local Apple 401 while checking profiles.
- CLI App Store status/group setup also received Apple 401; server upload credentials are separately selected. This does not yet establish an upload failure.
- First scheduling attempt with What to Test failed because EAS changelog submission requires Enterprise; no submission was created. Retried without changelog and with existing groups unchanged (--no-auto-testflight-setup): successfully scheduled d220d753-276c-4d02-a479-a8ba0850796b.
- No Apple account, API key, tester group, production flag or live advertising setting was changed.

## Required owner action and exact retry
Owner reported Apple sign-in complete and upload was retried. Authenticated browser inspection shows Apple Developer Program License Agreement accepted July 19, 2026; App Store Connect Business shows Free Apps Agreement Active and Paid Apps Agreement New with "View and Agree to Terms". The paid agreement is an outstanding owner account/legal step; the generic retry failures do not prove that it caused those failures. Owner was asked to review/resolve this specific agreement. No agreement, payment, tax or banking declaration was accepted or supplied by the agent.

After the owner reports resolution, retry the latest submission, without rebuilding or selecting latest:

```powershell
npx --yes eas-cli submit:retry b2055dbf-f14d-4c40-944e-278ff24f0ecd --non-interactive
```

If EAS no longer permits retry, create a new submission of build d2b42bb1-3892-4cc4-8fc9-dc0f5b648ab8 with the testflight profile, --non-interactive --no-wait --no-auto-testflight-setup. Capture the actual new ID/result. Then verify upload/Apple processing and request build-23 originals. Do not claim the failed upload reached TestFlight.

## Capture handoff
Once available, install the new version/build on the physical iPhone 16. Capture original PNGs, English/Nepali and popup states, Today's 10 answer/correction/completion, typed and saved-audio feedback, and Camera results as specified in docs/design/v1-ui/README.md. Record build number, iOS version, theme and text size. An absent control remains an absent control.

Await originals before generating proposals; each proposal gets a separate image agent and full original/output path. No simulated or generated baseline is accepted. The installed binary and returned screenshots are separate proof from successful upload.
