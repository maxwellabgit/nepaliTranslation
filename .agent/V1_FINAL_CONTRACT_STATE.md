status: IN_PROGRESS
base_sha: 974f7c0d4cf37bfb4356545d3fd80af570b4e3d3
head_sha: acdd67e9885ddb3f119f14275d8c6934614cb6f9
branch: cursor/v1-complete-build
current_phase: 3
completed_gates: C0, C1
completed_phases: none. Phase 2 SQL proof is BLOCKED. Phase 3 source status is in progress.
internal_testflight: NO-GO
public_v1: NO-GO
last_green_commands: npx supabase db reset && npx supabase test db (27 files, 259 tests, PASS, fresh database only, 2026-09-25). node --test scripts/exclusionManifest.test.mjs (4 pass). mobile jest mediaSync-test (5 pass). deno test admob_ssv_test.ts (10 pass). Upgrade-path pgTAP was not run.
origin_main_sha: ecacf89eedf38ef7b001d57c1878989c787c68f9
evidence_paths: supabase/migrations/20260924120000_phase2_subject_and_sharing.sql; supabase/tests/26_phase2_subject_and_sharing.test.sql; supabase/migrations/20260924130000_phase3_deletion_status.sql; mobile/src/storage/pendingDeletion.ts
human_blockers: English-to-Nepali model certificate FAIL in docs/MODEL_CERT.md (formal chrF 0.4468 floor 0.55; informal chrF 0.4440 floor 0.50) not re-run; physical iPhone and iPad proof absent; hosted Supabase, App Store Connect, AdMob, and RevenueCat are not configured; owner must confirm NPR 199 is an Apple price point before the Nepal storefront is set; upgrade-path pgTAP from the pre-finalization schema was not run; hosted schedulers were not executed
next_action: Run the upgrade-path pgTAP on a database created from the pre-finalization schema, then re-run exact-weight certification. Do not mark any phase done. Public V1 stays NO-GO.
updated_at_utc: 2026-09-25T02:40:00Z
