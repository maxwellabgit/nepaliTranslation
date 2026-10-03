# Owner UI completion follow-up — 2026-10-02

Scope: exact owner requests from the two latest UI rounds; source and local/browser verification only. Native C1/full C13 and hosted service proof stay open.

Implemented:
- Home removes count, input speaker and companion-script line. Gold language/navigation/script controls; formal switch gold, absent for Nepali source. Softer green Send rises/drops over180ms, matching microphone timing; starts hidden, input focus reveals, blur hides, keyboard submission preserved. Web tab/a11y handling and outside-click Send protection retained.
- Selector has balanced gaps between banner and taller input; output lifted with bottom space, normal22px system font. Nepali-source microphone prompt/Send/feedback follows Devanagari/Roman setting. Global Settings third language supports persistent Romanized Nepali chrome and mounted output script refresh.
- One shared header keeps larger coin/timer mounted at the same place across primary pages and overlays. Existing credit stacking/flight destination remain intact. Static banners/popups have gold borders; video ads unchanged.
- Shared Home/History local editor: prefilled22px normal text, edit/save labels, no device/reward copy or metadata pickers, adjacent Cancel/Save and outside dismissal. Open editor snapshots original result identity; editing does not clear another request's busy state. History restores actual row IDs, saves original request-time metadata and serializes reads/mutations so Clear cannot resurrect earlier rows. No feedback credits or new uploads.
- Back below Skip, comparison Back, preserved drafts, and saving guards including header Back. Category arrows higher contrast.
- Shared PromoRotator preserves ad instance across filled-state changes, fixing the60–120second mount/cleanup loop. Native and hosted app use this code; physical-device confirmation remains open. Attached video was2.9333seconds, existing frames inspected then discarded; no new app screenshots/recordings.
- Shared neural display punctuation follows input endings (including question/exclamation, Devanagari danda/Latin period, quotes and ellipsis); internal punctuation/decimal dots preserved, sentence chunking handles closing quotes and common abbreviations. Formatting change, no model/gold/quality claim.

Evidence:
- Locked mobile npmci PASS (.agent/ui-refine-install.log).
- Final verify:beta PASS:113unit suites/547tests +2integration suites/30tests=577; lint/typecheck/translation/18pins/usage/ExpoDoctor21 PASS (.agent/ui-refine-beta.log).
- Web export/host preparation/TG production build PASS (ui-refine-export/hosted/testing-ground.log).
- Real Edge local-WASM smoke PASS (.agent/ui-refine-browser.log): focused green Send geometry, normal output, output-only speaker, outside editor dismissal, fixed timer position, actual History Clear, Reset0:00/noaward and ordinary-remount retention.
- Fresh independent reviews PASS: UI10suites/72tests; storage/editor/punctuation/Back12suites/90tests. Material editor targeting/busy, navigation saving, storage resurrection and sentence-boundary findings repaired with regressions.

Limits: existing public-release model/native/hosted gates remain open. Rewarded receipt migration20261002230000 is not deployed here; no live Supabase retrieval/deletion, SSV permanence or Apple/real-ad proof invented. TestFlight submission remains paused after owner's stop; existing main-push authorization remains valid. No secrets/flags/dependencies/gold references changed.

Completion audit found prior GitHub backend-gate pgTAP12 expected retiredphoto collection (production denial correct); test alignment is a separateC9 slice, and test30 receipt passed in priorrun while overallbackendfailed. Prior agent-gates coverage/legacybrowser failures remain distinct from final localbetaPASS; current browser fixtures passed22desktop/5explicit skips with media off (C13_SCENARIO_CLEANUP_2026-10-02.md and ui-refine-scenarios.log). Do not claim fullCI until candidatechecks pass.

Committed scopes: C3 c3870df; C4 8af1138; C13 af8763b (runtime) and a8e0a19 (scenarios); C9 64957e6 (historical SQL test alignment). Documentation independent review PASS after final prepared/export bundle hashes matched. Native/hosted/full CI proof unchanged.

Final CI audit and test follow-up: source `0007b4a` backend-gates PASS (fresh/upgraded database and admin); agent-gates browser PASS (70 passed/11 explicit skips), model/secret checks PASS, beta577 PASS, but critical coverage failed contribution/ads ratchets. Added meaningful tests only: correction storage retry/pending guards, skipped-ad durability/provisional duplication/session and storage failures, consent failure/withdrawal, capture failure cleanup/retry and duplicate-ID guest isolation. Fresh independent review PASS with37 focused tests. Final local full-unit coverage PASS against unchanged baselines: contribution branches79.79%, ads statements85.25%/branches74.34%/lines88.10%; every critical group meets ratchet and80%line/70%branch floors. Lint/typecheck PASS. Receipts: ui-refine-coverage.log, ui-refine-final-lint.log, ui-refine-final-typecheck.log. Runtime/exported bundle unchanged; no new media. Final test-commit CI is recorded separately when completed.

Final pre-pivot exact-source CI: f3ff2e15263433b1c453cf7a7ddd053db703ff07 main agent-gates [37092862500](https://github.com/maxwellabgit/nepaliTranslation/actions/runs/37092862500) and backend-gate [37092862452](https://github.com/maxwellabgit/nepaliTranslation/actions/runs/37092862452) both SUCCESS. This closes the pending CI evidence above for the earlier UI scope; the later authenticated-guest pivot has its own checks. No hosted deployment or native proof is inferred.
