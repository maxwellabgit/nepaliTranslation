# C4 scoped welcome and timer UI proof

Owner request, 2026-10-02: replace first-ever Welcome and returning Go ad-free with one readable credit-award popup over Home; Continue dismisses it and starts coins; remove the filling bar and shrink/align the timer at top right. This direct instruction authorizes this specific browser-reviewed implementation. It does not satisfy the general C1 physical-iPhone baseline or close full C4.

## Result
- Fresh installation: bilingual startup acceptance, then one 10-credit / 100-minute card. It remains until Continue. Later New York date: one 5-credit / 50-minute card, with different copy. No introductory subscription popup.
- Bounded, scrollable transparent Modal keeps Home visible and Continue reachable at large text. After Continue, the scrim/card are removed and coins alone animate over usable Home toward the measured timer center.
- Compact timer pill is 98 × 28 CSS pixels in the phone browser, placed at the header right; no progress bar. Ad eligibility/suppression and 12-hour storage cap remain intact.
- Grant written once per installation/date, independent of sign-in. Continue is durably acknowledged before flight; restart resumes an unacknowledged message or acknowledged flight without regrant. Actual capped minutes and prior balance are stored for accurate recovery copy.

## Commands and evidence
- `npm ci --prefix mobile`: PASS, postinstall Camera focus patch retained; dependency manifests unchanged.
- `npm run verify:beta --prefix mobile`: PASS after final behavior/accessibility/capped-copy fixes: 106 unit suites, 470 tests; 2 integration suites / 19 tests; 3 ads-config checks; translate/romanize, 18 model pins, iOS purpose strings, Expo Doctor 21/21.
- Final cosmetic header alignment: lint/typecheck PASS; direct Jest from mobile for DailyOpenPopups, dailyOpen, CreditsGauge: 3 suites / 17 tests PASS. Focused Jest reports unfinished asynchronous operations after success; full beta exits successfully.
- `npm run export:web --prefix mobile` and `npm run prepare:hosted --prefix testing-ground`: PASS. Final main bundle `index-f1f84f75eb4035a40ef57871c0b4b7ae.js`.
- `node testing-ground/scripts/record-welcome.cjs C:/Users/maxwe/.codex/visualizations/2026/10/02/01a0fa22-eb33-7f90-b45d-b4671ade62b5/welcome-final`: PASS. Actual Expo web app, isolated guest storage, offline recorded testing-ground adapter; no model/native-service claim. No animation speed changes.
- Both cards stay visible for five seconds before Continue in the recordings; coins appear about 3 ms after the click is completed. Both journeys reach Home. For each journey, three separate restarts (before Continue, during flight, after completion) preserve the exact grant receipt and end time. No repeated completed-day popup.
- Video playback verified: metadata loaded, playback advanced, no media errors. New user 24.68 seconds; recurring first daily open 11.84 seconds. VP8 WebM, 392 × 852, 25 fps; viewport 393 × 852.
- Matching popup/coin/Home frames decoded from each saved recording and inspected. No fleeting frame presented as a persistent screen.
- Fresh `/independent-reviewer`: initial FAIL for unbounded large-text layout; bounded ScrollView repair reviewed; final PASS with no material findings. Capped-minute copy and retired comments repaired. Reviewer independently ran focused tests and diff check.
- `git diff --check`: PASS. No gold, model, backend, dependency, live-flag or unrelated screen changes.

## Artifacts (absolute paths)
`C:/Users/maxwe/.codex/visualizations/2026/10/02/01a0fa22-eb33-7f90-b45d-b4671ade62b5/welcome-final/updated_new_user_introduction.webm`

`C:/Users/maxwe/.codex/visualizations/2026/10/02/01a0fa22-eb33-7f90-b45d-b4671ade62b5/welcome-final/updated_recurring_daily_open.webm`

`C:/Users/maxwe/.codex/visualizations/2026/10/02/01a0fa22-eb33-7f90-b45d-b4671ade62b5/welcome-final/updated_welcome_proof.json`

Local player: `http://127.0.0.1:5173/intro-recordings/updated.html`. Generated media/player copies are ignored in testing-ground; reproducible recorder script is tracked.

## Limits
Browser evidence does not certify native iPhone/iPad gestures, Dynamic Type or accessibility. Existing TestFlight build 23 has the previous UI; no new native build was requested or uploaded here. C1/full C4/release gates remain open. Full `verify:ci` coverage ratchets remain the separately recorded pre-existing blocker; thresholds were not lowered and this slice does not claim C15 completion. New Nepali capped-award wording remains subject to bilingual owner sign-off.

## Owner image/coin refinement, 2026-10-02
The owner additionally requested retaining the original artwork and keeping coins outside the timer so it can widen as time increases. Original `credits-awarded-bg.png` now appears as a clipped popup header above the readable panel; no image generation or new asset. Static coin icon and measured flight destination sit outside the timer's left edge. Width animates over 220 ms to fit clock length/font scale, while pill height stays fixed and its right edge remains anchored.

Locked install PASS. First regression run caught an unnecessary initial equal-width animation updating outside test `act`; skip that no-op animation. Final `verify:beta` PASS (470 unit / 19 integration / ads config / translation / 18 model pins / usage / Expo Doctor 21/21). Final web export main bundle `index-1be032cf0ca0ce3885b8bb273090599f.js`. Recorder PASS for both flows and all six recovery states; width increases and static coin clearance explicitly asserted. Browser RAF audit: 265 sampled frames, 863 visible coin observations, zero rectangle overlaps with timer, welcome width 52 → 76.8 px. Daily width 52 → 60 px; height 28 px unchanged. Existing grant amounts and storage behavior untouched.

Final refinement artifacts are under `C:/Users/maxwe/.codex/visualizations/2026/10/02/01a0fa22-eb33-7f90-b45d-b4671ade62b5/welcome-image-final/`: `updated_new_user_introduction.webm`, `updated_recurring_daily_open.webm`, matching popup/coins/Home PNGs, `updated_welcome_proof.json`, and `coin_clearance.json`. These supersede the prior visual artifacts for the refinement. Fresh source reviewer reports no material findings; native proof and release gates remain open.

## Expanded artwork and centered timer, 2026-10-02
Owner explicitly approved these narrow browser-directed edits: artwork frame 240 px with a 420 px image; centered timer text; bounded centered coin fans for larger awards. Coin counts are 7 for 1-10 credits, 12 for 11-20, 17 for 21-30, 22 for 31-40, and 30 for 41+; welcome 10 and daily 5 both use 7. Grant logic unchanged.
Final verify:beta PASS: 106 unit suites/478 tests, 2 integration suites/22 tests, translation/ads/model pins/usage/Doctor checks. Export index-4e4569899e6b95a124d87c091a529dea.js. Fresh independent source review PASS after cancellation repair in separate C13 scope. Popup-only browser recordings use explicit startup-consent test fixture, with real award/Continue/flight behavior. Both journeys and six restart states PASS; both WebM files play without media errors. Visual popup screenshot inspected.
Artifacts: C:/Users/maxwe/.codex/visualizations/2026/10/02/01a0fa22-eb33-7f90-b45d-b4671ade62b5/welcome-expanded/updated_new_user_introduction.webm and updated_recurring_daily_open.webm; updated_welcome_proof.json and popup/coins/Home screenshots in the same directory. Viewer /intro-recordings/expanded.html. Browser proof is not native C1 proof; TestFlight 23 unchanged, full gates remain open.
