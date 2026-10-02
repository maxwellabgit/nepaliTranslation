# Diagnostic TestFlight screenshot build

Owner request, 2026-10-01 America/New_York: "You will have to push to TestFlight so I can provide screenshots. Do this now and continue as far as you can after you wait for my results".

Purpose: deliver the current native UI to the owner for physical iPhone 16 baseline screenshots before design changes. This explicitly authorized internal diagnostic build does not certify C1–C15 or public V1. Current source/functionality gaps remain in the requirement ledger and pivot inventory.

## Identity and distribution
- Branch: cursor/v1-final-contract-reconciliation-5907.
- Source baseline: 9aaf493; documentation reconciliation: e27457a.
- Binary source SHA: pending preflight commit.
- EAS project: 4d0a21e4-5c2e-45fa-b8fd-86a996abb404, mbucholzs-team/translate.
- Bundle: com.neptranslate.app; app version: 1.7.0.
- Build/submit profile: testflight; existing preview environment / testflight-internal channel / Google test units. Configuration and hosted flags unchanged.
- EAS build ID/build number: pending.
- Submission ID/upload: pending.
- Apple processing/availability: unverified.
- Installed device/native screenshots: unverified.

## Preflight slice and evidence
No layout redesign. Camera rendering now correlates highlights by immutable flattened frame indices; capture/dispatch hooks have explicit stable dependencies; unused state value and duplicate type import warnings are removed. Expo 57.0.25→57.0.26 and Camera 57.0.5→57.0.6 align with SDK 57 requirements; matching constants/core patches follow Expo's dependencies. Native focus patch applies successfully. No model/gold/schema/flag change.

- Initial verify:beta stopped on existing Camera immutability error and four warnings.
- npm ci: PASS, 1050 packages installed; native Camera focus patch PASS. Audit reported 9 moderate / 6 high vulnerabilities; no unrelated automatic dependency upgrade applied.
- First verify:ci: lint/typecheck PASS; 106 unit suites / 466 tests PASS; 2 integration suites / 19 tests PASS; test-ad configuration 3/3 PASS; translation checks and 18 model pins PASS; iOS usage strings PASS. Expo Doctor 20/21 stopped coverage/export because two SDK patch versions were outdated.
- Final npm ci and verify:beta portion after SDK patches: PASS. Lint/typecheck, 466 unit / 19 integration / 3 test-ad checks, translation, model pins, usage descriptions, and Expo Doctor 21/21 all passed.
- verify:ci: FAIL at the coverage ratchet in unchanged contribution/entitlement/ad source groups. Contribution statements/branches 83.06/72.27 versus 84.59/79.34; entitlements statements/branches/lines 88.57/82.58/90.31 versus 89.52/83.89/91.33; ads 81.64/72.45/84.76 versus 84.90/73.90/87.56. Absolute 80% line / 70% branch floors pass. No baseline lowered; C15 remains open. Web export will run separately because the chained command stopped before it.
- Fresh independent reviewer: final Camera/config/dependency review PASS, no material findings. Native compilation and capture cancellation remain separate proof.
- git diff --check: PASS before final documentation update.

## Capture handoff
Once available, install the new version/build on the physical iPhone 16. Capture original PNGs, English/Nepali and popup states, Today's 10 answer/correction/completion, typed and saved-audio feedback, and Camera results as specified in docs/design/v1-ui/README.md. Record build number, iOS version, theme and text size. An absent control remains an absent control.

Await originals before generating proposals; each proposal gets a separate image agent and full original/output path. No simulated or generated baseline is accepted. The installed binary and returned screenshots are separate proof from successful upload.
