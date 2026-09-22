# R6–R9 blockers — honest record

This document exists so a fresh agent or human reviewer entering this repo can immediately see what R6 (model quality), R7 (UI/testing-ground polish), R8 (hosted operations), and R9 (release candidate + device matrix) require that this Cloud Agent VM cannot autonomously satisfy.

Nothing in this document invents progress. Every item is a real blocker whose resolution requires a specific external resource.

Ship program: [`plans/active/v1-testflight-runbook.md`](../plans/active/v1-testflight-runbook.md). Audit trail: [`docs/NepTranslate_V1_Finalization_and_TestFlight_Runbook_71c85df.md`](./NepTranslate_V1_Finalization_and_TestFlight_Runbook_71c85df.md).

---

## R6 — Neural EN→NE quality lift

**Blocker:** the cloud VM has no GPU. `nvidia-smi` is not installed, `/dev/nvidia*` does not exist, RAM is 15 GiB and CPU is 4 cores. This is documented in the earlier R0 investigation and confirmed at the tip of this branch.

**Failure evidence, not invented:**

| Class | Measured chrF | Floor | Register | Verdict |
|---|---:|---:|---|---|
| `en_ne_formal` | 0.4468 | 0.55 | तपाईं 0.7% (floor 15%) | FAIL |
| `en_ne_informal` | 0.4440 | 0.50 | तिमी 0.0% (floor 10%) | FAIL |
| `ne_en_deva` | 0.6111 | 0.55 | — | PASS |
| `ne_en_roman` | 0.4248 | 0.40 | — | PASS |

Recorded in [`docs/MODEL_CERT.md`](./MODEL_CERT.md) under the G4 2026-09-22 run against the exact pinned IT2 dist-200M ONNX int8 weights. Do not overwrite this file with a synthetic pass.

**Required resources to close R6:**

1. A GPU box with ≥ 12 GiB VRAM for a LoRA on IT2 dist-200M FP16, or ≥ 24 GiB VRAM for full fine-tune. Founder machine or rented A100/H100.
2. A **new** private uncontaminated holdout — the current gold set has been marked public-exposed via R2's `review_exclusions` when it enters a live public-review window. Producing this holdout is a curation task, not autonomous code.
3. Register-conditioned data or decoding hints: the failing rate is 0% / 0.7% for तिमी / तपाईं. Fix candidates in dependency order — first verify the runtime actually passes the correct register tag to the decoder (this is `mt-accuracy` lane, no GPU); then attempt logit-bias / forced-decoder-ids for pronouns; only then LoRA fine-tune.
4. Deterministic INT8 ONNX export + pinned manifest hash update + a fresh `certify_ship_artifacts.py` run showing chrF ≥ 0.55 formal, ≥ 0.50 informal, register floors met, and the exact hash matching the release bundle.

**What R6 is NOT:** lowering the frozen thresholds, editing gold references, or dropping the register floor. The audit stop-ship condition on quality remains binding.

---

## R7 — Mobile/iPad UI polish + Windows testing-ground scenario coverage

**Landed autonomously:**

- Mobile Review workflow with 5/5 unit tests covering guest, flag-off, item advance, correction-required, error branches (see R3 in the runbook).
- Testing-ground scenarios expanded in R0.3-4 (10 F9 scenarios + 12 product scenarios; 70/78 pass, 8 platform-native skips).
- Build-provenance surface in Settings → About.

**Blockers requiring physical device time:**

- iPhone landscape/portrait, iPad split-view, Dynamic Type, VoiceOver, Reduce Motion, and 44-pt touch-target sweeps. These are the audit's R7 mobile checklist items and none of them are Playwright-testable — Playwright renders the Expo web export in a headless Chromium, which does not exercise SafeArea, ML Kit, native mic/camera, or iOS accessibility.
- Wiring the new `ReviewScreen` into `AppShell` as a real overlay or route + adding an `admin-api` mutating endpoint set for the required admin panels (unsatisfactory / late reject / quarantine resolution / submission diff). This is not just scaffolding — it is service-role Edge Function work with role checks and audit logging that R3 explicitly enumerated as "not yet wired" so no operator would mistake the current admin page for a complete surface.

**What lands in this branch:**

Nothing. R7 is documented here as the remaining human/device work. Adding untested UI wiring for `ReviewScreen` would violate the audit's rule 4 ("A test that currently exposes a real defect must be fixed at the implementation boundary") because the shell wiring is not tested against a real device.

---

## R8 — Deploy Supabase, cron, backups, legal URLs, alerts on staging

**Landed autonomously (templates + code, not deployment proof):**

- Every migration this program landed (`20260919…` through `20260923030000_r3_review_eligibility.sql`).
- Edge functions in `supabase/functions/` including R1's non-swallowing rotation, R4's withdrawal RPC, R2's importer batch RPC.
- `supabase/functions/schedules/process-scheduled-jobs.yaml` template.
- `docs/OPERATIONS.md` scheduler contract, secret matrix, feature-flag kill switches, backup/PITR checklist, legal-URL requirements, alert routes, rollback rehearsal.
- `scripts/check_review_exclusions.mjs` CI guard against training/eval leaks.

**Blockers requiring external services:**

1. **Staging + production Supabase projects.** Create both; run `supabase db push` for the R0–R3 migrations; run `supabase test db` against a fresh clone and an upgrade clone; verify pgTAP passes.
2. **CRON_SECRET rotation + hosted scheduler.** Provision the every-minute cron against `process-scheduled-jobs`; observe `not_due` between 5 PM ticks; observe exactly one successful close at 5 PM NY.
3. **Backups / PITR / storage rate limits / budget alarms / Edge function logs / error tracking** — Supabase console + external monitoring.
4. **Alerts:** missed 5 PM close, reward lag, importer failure, media queue growth, deletion deadline breach, webhook failure, feature-flag fetch failure.
5. **Real HTTPS Terms / Privacy / deletion / support URLs.** The exact copy is a human legal review (post-language sign-off).
6. **Rollback rehearsal.** Flags off first, then app/backend rollback. Must not restore deleted user content or double-issue rewards. Document the exact sequence in a signed evidence bundle.

**What R8 is NOT:** treating the presence of `.yaml` and `.sql` files as deployment proof. The templates are necessary but not sufficient.

---

## R9 — Release candidate + physical device matrix

**Blocker:** every item in this section requires a real iPhone / iPad in a human's hand, connected to Apple Developer + App Store Connect + TestFlight.

**Sequence documented in [`docs/RELEASE_RUNBOOK.md`](./RELEASE_RUNBOOK.md) — do not shortcut with `npx testflight`.**

1. Branch `release/1.7.0-rc1-5907` only from a green `main` after R0–R8.
2. `npx eas-cli@latest build --platform ios --profile testflight` under the dedicated `testflight` profile added in R0.10 (store distribution, autoIncrement, `EXPO_PUBLIC_ADS_ENV=test`, `EXPO_PUBLIC_RELEASE_CHANNEL=testflight-internal`).
3. Install on at least: one small/older supported iPhone, one current iPhone, one iPad.
4. Fill [`DEVICE_PROOF.md`](./DEVICE_PROOF.md) with build number, Git SHA, model manifest hash, and flag snapshot for the tested build.
5. Execute the ten-case test script from the audit (first-launch consent both languages, guest translate, offline, speech, camera, two-person, learn, iPad, stability, privacy).
6. Enable subsystems one at a time in the R8 hosted flag set — auth → review → speech → photos → telemetry → banners/rewarded → RevenueCat → deletion processing — and prove each returns to core translation after being flipped off.
7. Seven consecutive America/New_York review rotations with no duplicate grant, missed close, deletion SLA breach, or unexplained contributor-data loss.
8. External V1 go/no-go against the audit's final checklist. Requires R6 quality PASS, R8 hosted proof, and human sign-off on legal + bilingual copy.

**What R9 is NOT:** any label of "V1 release candidate" applied to a build produced solely by this Cloud Agent. The audit stop-ship condition on "the exact submitted SHA differs from the tested SHA" applies here.

---

## Summary — what the Cloud Agent has and has not done

| Gate | Cloud Agent contribution | Remaining |
|---|---|---|
| R0 | Green baseline (js-verify, playwright, admin, ship-cert, model-hash, secret-scan) + docs + testflight EAS profile + build-provenance + honest coverage baseline | Human PR merge |
| R1 | Forward-only migration; supabase CI green; DST + not_due + advisory lock + apply_reward-only + skip/report=0 | Human PR merge |
| R2 | Corpus registry + importer + retire-on-close + exclusions gate; supabase CI green | Human staging import |
| R3 | Server eligibility guard + mobile Review UI + admin page skeleton | Full admin-api mutating endpoints; shell wiring; device polish |
| R4 | auth.uid() authorization; withdrawal RPC; deletion manifest; purge tags exclusions | Real speech/photo capture on device |
| R5 | Bounded timeouts + listener cleanup on ad load/show paths; SSV code already at R0/G3 | Physical device + RevenueCat sandbox matrix |
| **R6** | Nothing — no GPU on this VM | GPU + fresh private holdout + register lift |
| **R7** | Nothing beyond what earlier gates landed | Physical device + admin-api extension |
| **R8** | Templates, migrations, scheduler descriptor, secret matrix, CI guard | Provision + deploy + observe on staging |
| **R9** | Nothing — physical device required | TestFlight builds + device matrix + external cohort |

The first useful milestone the audit specified is a green **R0+R1 stacked** internal TestFlight with all optional flags off. R0+R1 is now green on GitHub CI (see the R1 branch tip); the actual TestFlight build is R9 human work.
