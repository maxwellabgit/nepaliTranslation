# Bola — TestFlight to production checklist

Updated 2026-10-04. Diagnostic 1.7.0 (27), exact 967b613, built and submitted successfully. Apple processed it and assigned Team (Expo); internal availability verified. Reviewed fixes: bold current-direction arrow, visible Settings Credits action, recoverable config/consent, safe explicit reward stacking and credit-denominated awards. Full local mobile gates (631 tests), fresh review and both exact-source GitHub pipelines PASS. Previous 26 is processed/Team (Expo) assigned, with 1 install observed; native functionality remains unverified. Public release is not approved.

## Completed engineering and hosted setup

- [x] Remove visible account, login, provider, linking and recovery functionality. Retain private authenticated guest identity, credits and ownership; isolate previous consent and queued data after terminal credential loss.
- [x] Separate general Terms/Privacy acceptance from specific model-improvement consent and its 18+ gate. Optional speech defaults off, including renewed consent; Camera photos stay local. Owner approved the disclosures.
- [x] Implement the requested welcome, credits, timer, translation, history, feedback, review, Extra 10 and testing-ground changes, with meaningful tests and independent reviews. Native verification remains below.
- [x] Capture actual review answers and immutable revisions, plus typed/speech ratings and corrections. Feedback and review corrections do not earn ad-free credits.
- [x] Deploy guest authentication, migrations, endpoints and the deletion-only worker. Retired public review, review rewards and photo collection remain disabled.
- [x] Retrieve four real hosted synthetic records in your operator console: typed feedback, two review revisions and a one-second, 16,044-byte WAV. Verify audited JSON export, signed audio playback and source/result/consent/revision linkage.
- [x] Verify cross-owner denial and actual database/storage purge for two hosted cohorts in 29.3 and 11.1 seconds, retaining UUID and credits. Restore all collection flags off. Previously cached bytes are not claimed immediately revoked.
- [x] Deploy private in-app support and ad reporting, operator replies and owner-only deletion. Support needs no email or attachments and is excluded from training. Real guest API retry, ownership, deletion and admin-denial tests passed; operator reply and guest retrieval passed in the browser. Native support verification remains below.
- [x] Publish owner-approved bilingual Privacy, Terms, Support and Delete pages plus root app-ads.txt at https://maxwellabgit.github.io. Nine served files returned HTTPS 200 with exact approved hashes.
- [x] Save and read back matching public URLs, owned iOS ad identifiers and Bola's Supabase project/publishable key in EAS preview and production. Fix the unrelated Android-ID requirement for iOS builds. Normal TestFlight still forces Google demo units.
- [x] Fix the rewarded callback's matching unit, 20-minute reward and signed Google console-test HTTP 400 response. Google Verify succeeded; console tests grant no credits.
- [x] Create the Apple monthly subscription with US USD 2.99, Canada CAD 2.99 and Nepal USD 1.49 pricing and three-storefront availability. Agreements, bank and tax status were observed Active.
- [x] Pass exact-source CI: 375 SQL tests on fresh/upgraded databases, 69 Edge tests, 10 admin tests, 631 mobile tests, 14 public-support tests and required coverage, browser, export, Doctor, model-pin, exclusion and secret checks. Full local C10 checks and independent review also passed.

- [x] Build and submit diagnostic 1.7.0 (27), exact 967b613, with Google demo ads and collection/paywall off. Exact EAS build/submission FINISHED without error; Apple processed it and assigned Team (Expo); same-build native verification remains open.

## Actions requiring your access or device

- [x] Sign in to App Store Connect and RevenueCat. Apple build 26 processing/group assignment was verified; RevenueCat project 57ff517d was accessible.
- [ ] Confirm the RevenueCat email, then finish real Apple app/product/offering/ad_free/public-key/webhook configuration; only TestStore was previously configured. I can do configuration using the consoles after the email handoff.
- [ ] Verify AdMob payment readiness, app review and public listing linkage in the console. Owner reports AdMob setup completed; this does not independently prove live serving. Any remaining financial entry requires owner handoff.
- [x] Verify browser synthetic support deletion: guest displayed Deleted, fresh reply retrieval and operator refresh showed no request, and an exact-message SQL query returned zero rows. No new privileged deletion was needed.
- [ ] Install the newest diagnostic build on your **iPhone 17 Pro and an iPad**, and record build, source SHA, device and OS. Earlier builds cannot prove new support behavior. Supply original native captures with provenance before any further visual redesign.
- [ ] Provide the **32-character hexadecimal AdMob SDK test-device identifier** for your iPhone 17 Pro, rather than its serial number or Apple UDID. I can prepare a separate owner-unit SSV candidate with the device enrolled as a test device. Test ads generate no revenue.
- [ ] Provide the actual native subscription review screenshot and approve any remaining bilingual/legal/store copy. I can complete the remaining metadata after console access.

## Tests we finish together on the exact candidate

- [ ] New install and daily return: readable award artwork over Home, Continue-triggered coin flight, ten/five credits once per New York date, ten minutes per credit, twelve-hour cap and restart persistence. Timer and coins stay consistent across pages; one/two-coin ad awards match their amounts.
- [ ] Typed translation: direction changes and submission preserve input; focus-only Send animation works; output font/color/punctuation are correct; Nepali labels follow the script setting; formality hides for Nepali input; speech playback appears only on output. Verify history clear and shared feedback edit/save/cancel/outside dismissal.
- [ ] Camera and speech: on-device OCR, result, retake, Back/Done and subsequent capture work; no-text rejection and temporary-file cleanup work; no photos upload. Microphone, STT, MT and clipboard work offline and through interruptions.
- [ ] Today's 10: skip cannot complete a category; all answers are required; Back preserves drafts; completed sets remain reopenable and revisable; Extra 10 works per category. The thanks-only countdown reaches 5 PM New York across DST. Authorized uploads preserve original/revised responses; no review credits are granted.
- [ ] Identity and consent: first launch has no registration or 18+ gate; contribution opt-in has its separate 18+ requirement; speech remains off by default. UUID survives restart and network failure; terminal loss isolates previous consent/queues. Terms acceptance alone uploads nothing.
- [ ] Separately approve a short native synthetic collection window. Collection flags affect the production project as a whole. I will use synthetic data, verify native typed/review/audio capture and retrieval, then restore flags off; the completed backend test is not ongoing cohort authorization.
- [ ] Verify real audio up to 60 seconds and at least four offline queued clips through restart, process termination and queue saturation. Reconnected uploads and signed playback must match the native recordings. Generated WAV proof does not certify native capture.
- [ ] Withdraw/delete while offline: sharing stops immediately, the original deadline persists and retries succeed after reconnect. Verify backend object/report purge, honest pending/completed states and preserved credits, UUID and local history. Fresh consent cannot cancel an open deletion.
- [ ] Ads: banners appear only on idle Translate/Learn; 60-second rotation does not flicker. Automatic interstitials respect ten minutes of foreground activity, no daily cap and Send/Camera/activity-complete safe points. Local grants and subscriptions suppress ads; load failure, dismissal, interruption and offline states leave core translation usable.
- [ ] Owner-unit SSV: an exact signed owner receipt grants two credits/twenty minutes once; duplicates, replay and restart cannot double grant. Displayed-ad skip grants one credit/one coin without persisting provisional full rewards. Demo-unit builds cannot prove owner receipts.
- [ ] Separately authorize a sandbox paywall window. Verify localized prices in US/Canada/Nepal, UUID binding before purchase/restore, buy/restore/cancel/expiry and the accepted reinstall tradeoff, without false ad-free entitlement. Restore paywall off after testing.
- [ ] Verify support submission, retry, operator reply, retrieval and deletion on the native build, with clear separate disclosure and no contribution-consent dependency.
- [ ] Verify both devices' Dynamic Type, VoiceOver, keyboard, safe areas, permissions, background/foreground and failure cases. Core translation must remain usable when Supabase, ads or RevenueCat fail.

## Remaining production work I can lead after access and proof

- [ ] Complete RevenueCat integration and the backend webhook secret securely; verify real sandbox events, retries and cancellations. Keep secrets out of mobile/admin bundles and enable the paywall only with explicit rollout approval.
- [ ] Set Apple privacy/support/marketing/deletion references to approved public pages. Reconcile privacy answers with SDK behavior, permissions, age/store availability, review notes/assets and subscription readiness. Do not invent a public contact email.
- [ ] Configure and verify UMP privacy messaging and refusal handling. Link AdMob to the actual public Apple listing and developer website; verify app-ads crawling and app approval. Current Apple-ID lookup returns no public listing.
- [ ] Host the operator console durably with its existing authorization. Review the concrete new origin and any access expansion before deployment. The current localhost console requires its server to remain running.
- [ ] Verify scheduler health and overdue-deletion alerts, configure an approved recipient, test backup/restore in an isolated project, and rehearse rollback/kill switches without resurrecting deleted data. Successful purges alone do not prove monitoring or recovery.
- [ ] Establish contribution triage, provenance and a reviewed anonymized-derivative process before training or public export. Raw guest-linked text/audio is not anonymous. Support is excluded from training; no automatic training or gold contamination.
- [ ] Validate a final production candidate with owned ads, exact source/assets/flags and mandatory release evidence. The existing model certificate remains unresolved and unwaived; no model optimization is part of this effort. Any change to that release requirement needs a separate explicit contract decision.
- [ ] Obtain your explicit public release/rollout approval, submit app and subscription, resolve Apple review findings and stage the release. After listing/payment/app approval and native proof, enable approved advertising/collection settings and verify real revenue plus consented data retrieval/retention. TestFlight ads produce no revenue.
- [ ] Monitor crashes, ad fill, reward failures, purchases, upload queues and deletion lag. Answer support, review consented contributions and fix release blockers before expanding the rollout.

Public release remains NO-GO. Hosted capture/retrieval/deletion and public pages are proven; native functionality, StoreKit/AdMob and the external release gates still need evidence. The controlled collection test ended with text/speech/photos/public-review flags off at version 16; paywall and telemetry remain off. Website publication and green CI do not authorize ongoing collection or live ads.

2026-10-04 repair verification: source 967b613 and diagnostic 27 add current-direction emphasis, Settings → Credits → Watch an optional ad for 2 credits, current-state ad checks and earned-balance stacking. Full local 631 mobile tests and exact-source agent/backend pipelines PASS; native examination remains required. Build/submission finished without error; Apple processing and existing Team (Expo) assignment verified; same-build native functionality remains pending.
