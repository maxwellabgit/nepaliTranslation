# Ten-objective validation

Date: 2026-10-01. Branch: `cursor/ten-objectives-repair-04f3`.

This file records commands that ran in this workspace, their results, and the proof that is still missing. A passing local test is not a completed objective when the contract also requires a native device, a deployed backend, a hosted policy, or a measured install size.

## SHAs

| Role | Full SHA |
|------|----------|
| `main` base | `e6bc3de2e89c532820e246d3faad74213bdf3cc6` |
| Reused feature tip (not rebuilt) | `bcfcd58dfb3f9f4ef36c6ab147a3e33e46551fe3` |
| Repair: interstitial clock and contract text | `67c92c135571b3993fc9aca76a952bf24e39f15f` |
| Repair: installation credits, root flight, sample ratio | `64f05abf4e8ed12f529b2e0a372b22e289ed43e7` |
| Repair: photo close, speech ownership, camera text | `54325391a17df7e7cef19f07a63201d4a48eaf56` |

Reused implementation commits, oldest first:

| Full SHA | Subject |
|----------|---------|
| `cc79fab2f8511d7d84b0b5131694ac1dd82de744` | Ship welcome credits, camera tap-to-focus, and an interrupting video when the ad timer ends. |
| `11d0cd05236bcdd21f3767986f537e95a404183d` | Ship bundled review samples, record a 90 percent finish, and confirm camera copies. |
| `117a0b24ca15a38225b64f962c902f867c8840f1` | Keep the captured photo visible above a translation sheet you can lower. |
| `43f6c818c61b369e2966c69ff5ae18ddfa2c3aba` | Stop collecting Camera photos and save rated speech with the transcript. |
| `bcfcd58dfb3f9f4ef36c6ab147a3e33e46551fe3` | Ignore tiny background text and cycle camera highlights through three colors. |

The interrupt-until-presented clock from `cc79fab2f8511d7d84b0b5131694ac1dd82de744` is reverted in `67c92c135571b3993fc9aca76a952bf24e39f15f`. Daily-open ad-free time still suppresses that interstitial. Banners, the web sample video, subscription, and rewarded ads stay.

## Decision

**SOURCE REPAIRS IN PROGRESS / DEVICE OR DEPLOYMENT VALIDATION PENDING**

No objective is complete. The October 1 post-push review found functional gaps after `a9d8cc8d8aace77b2946d416fac0b2b14125b263`. This working tree repairs sample delivery, speech feedback and offline limits, tight camera highlights, a stuck Copied label, and the native camera permission text. Those repairs are not device proof, a hosted migration, or a measured install size.

## Status

| # | Objective | Status | Evidence here | Missing proof |
|---|-----------|--------|---------------|---------------|
| 1 | Root welcome sequence, automatic flight after the last popup, interrupted-flight recovery | Ready for validation | `DailyOpenPopups-test.tsx` expects `flying:10:` and `flying:5:` after the ad closes. `CreditAwardHost` is mounted beside `AppShell`. | A device pass that an interrupted flight resumes without a second grant, and that the flight does not cover an open modal, the microphone, or Camera capture. |
| 2 | 10 then 0 same day, then 5; v1 migration; persistence; midnight and DST; account changes | Ready for validation | `dailyOpen-test.ts`: first grant is 100 minutes, same New York day does not add time, the next day adds 50 minutes, stacking keeps leftover time, a v1 row migrates as already welcomed and the next day grants 5. | A device pass across New York midnight and a DST change, and two accounts on one installation sharing one welcome. |
| 3 | Focus patch, native compile, lens focus | Not complete | `node ./scripts/patch_expo_camera_focus.mjs` printed `patch_expo_camera_focus: ok` and exits non-zero when an anchored file is missing. The screen shows a ring only after `focusAt` resolves as accepted. | An iOS and Android release build of the locked Expo Camera sources, and a device recording that the lens moves. |
| 4 | At least 150 meanings, offline reachability, strict 333/334, retired pipeline, staged metric, airplane mode | Not complete | `sampleAllotment-test.ts`: roster count is at least 150; `333/370` is false; `334/370` is true; `9/10` is false; `10/10` crosses once; account B does not inherit account A. `public-review` returns `review_retired`. | Apply `20261001150000_retire_photo_review_sample_progress.sql` and `record-sample-progress` on staging. Airplane-mode device pass that every meaning opens offline and the crossing stays pending until the server receipt. |
| 5 | Clipboard true, false, rejection, and repeat; VoiceOver | Not complete | `copyText` ignores `false` and a rejected promise, and a newer copy wins. The integration suite does not drive the clipboard. | A native clipboard and VoiceOver pass, including a failed write and a repeated tap. |
| 6 | Measured non-model size reduction | Not complete | `icon.png`, `favicon.png`, `splash-icon.png`, and `android-icon-foreground.png` were the same 1,483,610-byte SHA-256 `cbb3ffc3edd58241…`. The three duplicates are deleted. `app.json` points those slots at `./assets/icon.png`. About 4,450,830 source bytes left the tree. | A comparable production IPA or AAB before and after. Source-byte removal is not install-size proof. |
| 7 | Blank, texture, distant, near, numeric, and Nepali fixtures; no MT on empty; three theme colors; latency | Not complete | `ocrFixtures-test.ts` and `correlate-test.ts` keep a large `A`, `12`, and `क`; they drop a tiny `A`, an isolated combining mark, and a full-frame texture. An empty document makes no translation call. Highlights come from `getTheme` crimson, saffron, and blue. A blank model string fails the capture. | On-device OCR p95 latency for those fixtures. |
| 8 | Sheet snaps, scroll, reduced motion, frame time | Not complete | The result sheet is expanded before the stage is measured (`App.integration-test.tsx` camera drawer). Reduced motion sets the sheet open without the 420 ms timing. Drag stays on the handle. | A device frame-time recording of snap, scroll, and reduced motion. |
| 9 | Contiguous rendered and copied passage; bilingual review | Not complete | Copy-all joins translations with spaces, the same separator the sheet paints between spans. | A bilingual reviewer confirming the rendered Nepali and English passage and the copied string. |
| 10 | Image routes closed; owner-bound audio; five clips survive kill and restart; 60-second files; staged photo denial; hosted policies | Not complete | Photo enqueue returns null. `mediaSync-test.ts` rejects a legacy photo before fetch and a second flush stays rejected. Ownerless clips are not uploaded for a later account. Twenty pending clips return `not_saved` and the earlier clips remain. The listen timer stops at 60 seconds. | Five real clips after a process kill. A trimmed audio file, not only `durationMs`. Staging denial of `service_register_media_upload` and `service_complete_media_upload` for `photo`. Hosted storage policy and bucket inventory. Historical photo objects were not deleted. |

## Commands and results

Working directory `mobile/` unless noted. Node v22.14.0. Deno and the Supabase CLI are not installed. Docker is not available, so the SQL migration was not applied to a database.

| Command | Result |
|---------|--------|
| `npx tsc --noEmit` | Exit 0 |
| `npx eslint App.tsx src --max-warnings 0` | Exit 0 |
| `npm run test:unit` | Exit 0. 104 suites, 444 tests passed |
| `npm run test:integration` | Exit 0. 2 suites, 19 tests passed |
| `node --test scripts/testflightAdsConfig.test.cjs` | Exit 0. 3 tests passed |
| `npm run verify:translate` | Exit 0. Phrase, lexicon, direction, and romanize checks passed |
| `npm run check:model-hash` | Exit 0. `model-hash-check: ok (18 pins, schemaVersion=1)` |
| `node scripts/check_ios_usage_descriptions.mjs` | Exit 0. Camera, microphone, speech, and photo purpose strings present |
| `node ./scripts/patch_expo_camera_focus.mjs` | Exit 0. `patch_expo_camera_focus: ok` |
| `npm run verify:beta` | Exit 1 at the last step. Every step above passed, then `npx expo-doctor` reported 20/21. `expo` is 57.0.25 where the SDK check wants ~57.0.26, and `expo-camera` is 57.0.5 where it wants ~57.0.6. Those versions were already locked on `bcfcd58dfb3f9f4ef36c6ab147a3e33e46551fe3`. They were not bumped, because the focus patch is anchored to the installed camera sources. |
| `npm run verify:ci` | Not run. It calls `verify:beta` first. |
| Supabase SQL and Edge tests | Not run. No Deno, no Supabase CLI, no database. |

Baseline on `bcfcd58dfb3f9f4ef36c6ab147a3e33e46551fe3` before these repairs: lint exit 0, `tsc` exit 2 (`focusAt` missing on `CameraView`, unreachable photo comparisons in `mediaEnqueue.ts`), unit tests 441 passed, integration 5 failed in `App.integration-test.tsx` (duplicate speak label, microphone copy, Learn tab selection, idle house-ad id, camera drawer collapsed). Those five integration failures pass on this branch.

## Rollout checklist

Not performed. Names to apply on a non-production project first:

| Item | Name |
|------|------|
| Forward migration | `supabase/migrations/20261001150000_retire_photo_review_sample_progress.sql` |
| Register RPC | `public.service_register_media_upload` raises `photo_collection_retired` for `photo` |
| Complete RPC | `public.service_complete_media_upload` raises `photo_collection_retired` for a photo row |
| Progress RPC | `public.record_sample_progress` inserts `public.sample_allotment_events`. No credit grant |
| Progress Edge function | `record-sample-progress` |
| Retired Edge function | `public-review` returns HTTP 410 `review_retired` |
| Upload Edge function | `create-media-upload` accepts `speech` only |
| Scheduler function | `process-scheduled-jobs` still calls `service_close_ny_reward_window`, then always calls `service_list_due_deletion_requests` |
| Scheduler template | `supabase/functions/schedules/process-scheduled-jobs.yaml`, name `process-scheduled-jobs`, schedule `* * * * *`, timezone UTC. This repo does not provision that cron |
| Review RPCs left in old migrations and not called by the worker | `service_rotate_review_window`, `service_plan_review_lookahead` |
| Speech bucket | `contribution-speech` |
| Historical photo bucket | `contribution-photos`. New register paths do not select it. Existing objects were not listed or deleted |
| Client photo insert policy | Existing `contribution_photos_no_insert` remains. Signed uploads use the service role, so the RPC rejection is the new-photo gate. That policy was not re-checked on a host |

## What changed in source

- Welcome and daily grants persist in `neptranslate.dailyOpen.v2` after the write. A `neptranslate.dailyOpen.v1` row migrates as welcomed and does not add another 10 credits.
- The award overlay is `CreditAwardHost` at the app root. `startFlight` begins in `flying`. Collect remains for a message-phase claim.
- Sample progress is partitioned by `user:<id>` or `guest:<installation>` and manifest `review-roster-370`. Confirm and edit record a meaning. Skip and report do not.
- Pending speech stops at 20 clips or 32 MiB. A full queue returns `not_saved` and does not drop clips. Guest and non-consented clips are `localOnly`.
- Camera highlights use the theme tokens. Copy-all matches the spaced paragraph. A blank translation is `translate_failed`.

## Post-push repair

The review of `a9d8cc8d8aace77b2946d416fac0b2b14125b263` reproduced these defects. The source repair is:

| Defect | Repair |
|--------|--------|
| Sample progress had no caller, and the insert had no policy | Confirm/edit and the signed-in media flush call `deliverSampleProgress`. A new migration grants authenticated insert with `user_id = auth.uid()`, allows only manifest `review-roster-370`, and keeps the strict ratio. An acknowledged crossing is not queued again. |
| A later thumb stayed local after upload | `revise_media_feedback` updates the same speech row. The outbox keeps `synced` and sets `feedback_pending` until that revision is acknowledged. |
| Offline handoff bypassed the 20-clip / 32 MiB cap and evicted unsent audio | Unsent means not server-acknowledged. A full queue refuses the new clip. After acknowledgement, each account keeps four recent local copies and older acknowledged files are deleted. Withdrawal deletes that account's files. Utterance writes share one queue. Thumbs appear only after the save succeeds. |
| Tight camera lines overlapped, and a failed repeat copy left Copied on screen | Highlights for one photo are padded together against both neighbors. A `false` or rejected clipboard result clears the label; an older result does not. |
| Native permission text offered photo contributions | Camera purpose strings now say photos are temporary on-device translation input and are not uploaded. |

Hosted SQL is not applied by this repair. Native focus, gesture, audio duration, and install size remain unproven.

## Mixed-language Camera capture

Date: 2026-10-01. Windows testing ground, web export, Tesseract `eng+nep`. Not on-device ML Kit. Sample `nepTextEx2.jpg` SHA-256 `BDC678F679C96B69077ACDC7A881F315CB5A11BF3221F862633A90795F3CFA7A`, 334×598. The photo and the target mockup stay local.

One capture recognizes English, Devanagari, and Romanized Nepali. Switching “Translate to” reuses that capture. In the final Playwright run the OCR count stayed 1 across English, Nepali (Devanagari), and Nepali (Romanized).

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` in `mobile/` | Exit 0 |
| Camera unit tests (`captureRouting`, `correlate`, `ocrFixtures`, `browserOcrMap`) and `App.integration-test.tsx` | Passed |
| English passthrough | “35. Paying Respects”, “to bow down, salute.”, and “ear.” stay as recognized |
| Devanagari target | The Devanagari story stays the recognized paragraph |
| Romanized target | That Devanagari is transliterated, not sent through English |
| Nepali to English | Fail closed. This browser has no IndicTrans2 model, so those sections show a retry. The literary English sentence was not inserted |
| Highlights | English crimson, Devanagari saffron, Romanized blue, stable across targets. The drawing is not highlighted |
| Omission | Tesseract did not return `dhognu`. Romanized spelling lost macrons and a few words |

Screenshots from that run stayed in `testing-ground/output/mixed-capture/` and are not in git.

## Independent review

The note on `a9d8cc8` that a read-only pass found no material gaps does not match the post-push review. The table above is the source repair for those gaps. Objectives stay incomplete until the missing device and hosted checks pass.
