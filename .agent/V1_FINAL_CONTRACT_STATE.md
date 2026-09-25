status: IN_PROGRESS
base_sha: 974f7c0d4cf37bfb4356545d3fd80af570b4e3d3
head_sha: f74d85c26ae45853e4fead001a0c0073a8032b93
branch: cursor/v1-complete-build
current_phase: 3
completed_gates: C0, C1
completed_phases: none. Phase 2 SQL proof is BLOCKED. Phase 3 source status is in progress.
internal_testflight: NO-GO
public_v1: NO-GO
last_green_commands: Upgrade path on 2026-09-25 against f74d85c. Prior schema version 20260923220000 (baseline 974f7c0 / origin ecacf89). Then applied 20260924120000, 20260924130000, 20260924140000, 20260924150000. Pre-fix profile 11111111-1111-4111-8111-111111111111 kept startup_consent_version upgrade-survivor; speech_sharing and photo_sharing defaulted false; media_cancel_generation 0. npx supabase test db after that upgrade: 27 files, 259 tests, PASS, including 26_phase2_subject_and_sharing.test.sql. Fresh reset on the same SHA previously passed the same 259 tests.
origin_main_sha: ecacf89eedf38ef7b001d57c1878989c787c68f9
evidence_paths: supabase/migrations/20260924120000_phase2_subject_and_sharing.sql; supabase/tests/26_phase2_subject_and_sharing.test.sql; supabase/migrations/20260924130000_phase3_deletion_status.sql; mobile/src/storage/pendingDeletion.ts
human_blockers: English-to-Nepali model certificate FAIL in docs/MODEL_CERT.md (formal chrF 0.4468 floor 0.55; informal chrF 0.4440 floor 0.50) not re-run; physical iPhone and iPad proof absent; hosted Supabase, App Store Connect, AdMob, and RevenueCat are not configured; owner must confirm NPR 199 is an Apple price point before the Nepal storefront is set; hosted schedulers and a live private-bucket media round trip were not executed; requirement ledger 1-30 is not a PASS ledger
next_action: Re-run exact-weight certification when the pinned ONNX weights are present. Do not mark any phase done. Public V1 and internal TestFlight stay NO-GO.
updated_at_utc: 2026-09-25T13:00:00Z
