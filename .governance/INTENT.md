# INTENT
Last updated: 2026-09-23 (final contract reconciliation, base `034f1cc`)

## North Star
An **offline, on-device iOS / iPadOS app** that translates **English ↔ Nepali** in real time for live conversation and everyday text. Core speech recognition, machine translation, and Camera OCR run on the device. Developed on Windows; shipped via Expo EAS → TestFlight / App Store.

**Optional online services** (account, consented speech/photo sharing, public review, rewards, ads, subscription, admin, telemetry) may use Supabase, AdMob, and RevenueCat. They must never be required for typed translation, Camera processing, local history, Settings, or Learn. A failure, sign-out, or session expiry in any optional service must leave the offline core usable.

**Program status:** Foundation through `9b17ac9`, source slices **F0–F10**, gates **G0–G5** on `main` at `71c85df`, and remediation **R0–R9** integrated at `034f1cc` (`origin/cursor/v1-r6-r9-blockers-5907`) are historical evidence. They are not, by themselves, a release. The living ship contract is [`plans/active/v1-final-contract-reconciliation.md`](../plans/active/v1-final-contract-reconciliation.md) (gates **C0–C15**) on branch `cursor/v1-final-contract-reconciliation-5907`. Progress lives in [`.agent/V1_FINAL_CONTRACT_STATE.md`](../.agent/V1_FINAL_CONTRACT_STATE.md). Older active plans stay in the tree as history. Nothing labeled "implemented" is "deployed and operating" until hosted proof exists. The committed on-device model certificate still fails the English-to-Nepali formal and informal floors; that failure remains a public-release blocker.

## Product
**NepTranslate** — Nepali-first translation companion.

Public UI languages are **English** and **Nepali**. A language selector is available on first launch and later in Settings > General. Changing language updates first-launch text immediately.

### Primary surfaces
Exactly three: **Translate**, **Camera**, and **Learn**. There is no fourth bottom-navigation destination. The former Conversation experience stays inside Translate. Account is a section inside Settings, not a tab.

1. **Translate** — Typing, speaking, translations, and multi-turn exchange on one screen. Usable without an account and without optional network services.
2. **Camera** — On-device photo translation in both directions (Nepali → English and English → Nepali). Capture is portrait-oriented. Each detected sentence has a stable correlation identifier and one translucent highlight color shared by the image overlay and the translated sentence. Translated text sits below the captured image. A non-color cue (sentence number or focus synchronization) is required. Temporary capture files are deleted after retake, exit, or successful processing.
3. **Learn** — Bundled Nepali alphabet. Offline and login-free.

**Today's 10** is the only public correction surface. The title is “Today's 10”; the descriptive subtitle is “Review translations” (natural Nepali equivalents). Learn and Settings may link to that one route. There is one screen, one API, one submission model, and one reward path. A local “Edit translation” action may change local history only and must not create a rewarded public review.

### First launch versus account consent
First launch contains bilingual legal acceptance (Terms and Privacy Policy) and language choice. It does not require an account and does not require an 18+ attestation. The 18+ attestation is part of the signed-in contribution gate (public review and media sharing). Guests use Translate, Camera, local history, Settings, and Learn after first-launch legal acceptance.

### Toggles and UI language
- **Formal** — ON = formal Nepali; OFF = informal. Informal = **तिमी**, not तँ.
- **देवनागरी** — ON = Devanagari; OFF = Roman Nepali.
- **UI language** — English or नेपाली, on first launch and in Settings > General.

### Platforms
**iPhone and iPad** are both in V1 scope. Camera capture stays portrait-oriented. Chrome respects tablet size classes and supported iPad multitasking widths.

### Optional services (not core)

#### Identity
Supabase Auth + Sign in with Apple. Sign-in is required before any contribution, purchase, or restore. Authenticated sessions use a rolling inactivity expiration of **30 days**. Access tokens stay short-lived; the 30-day figure is inactivity timeout, not JWT lifetime. Session expiry signs the account out of account features and must not disable guest translation, Camera, history, Settings, or Learn.

RevenueCat `app_user_id` is the signed-in Supabase UUID before paywall or restore.

#### Account contribution consent
Separate from first-launch legal acceptance. Stored once per account for the current material consent version. A material version change requires new consent. Ordinary restarts do not.

Before public-review submission or speech/photo sharing, the account must have:

- explicit acceptance of the current versioned contribution/media consent;
- an 18+ attestation.

Settings > Account holds sign-in state, subscription controls, consent status/version, exactly two sharing toggles, withdraw contribution consent, and delete account.

- **Share speech recordings** — default off.
- **Share Camera photos** — default off.

Consent is the master authorization. The toggles are not a third consent switch. They cannot turn on until contribution consent and 18+ are recorded. Server-side checks enforce this; a client boolean is not authorization.

After consent, an eligible raw speech recording or Camera photo uploads automatically only when its matching toggle is on, the session is valid, and the remote flag is on. Uploads are non-blocking, account-linked, encrypted in transit, and stored in private buckets. Translation and OCR never wait on upload success.

Turning a toggle off stops new uploads of that media type. It is not consent withdrawal.

Withdrawing contribution consent stops every contribution upload immediately, clears that account's local pending contribution media, blocks public-review submission, preserves the auth account, subscription, translations, local history, and unrelated settings, and creates a durable deletion request with `due_at` = request time + 30 days. Re-consent is blocked while a withdrawal purge is pending.

Account deletion does all of the above and deletes the auth account only after linked storage and database data are confirmed deleted.

Account-linked contribution media/content is retained indefinitely until consent withdrawal or account deletion. Independently certified, irreversibly anonymized artifacts may be retained. Removing metadata or a user ID alone is not anonymization. Raw voice and face/environment photos are not presumed anonymous.

Deletion completes no later than the 30-day deadline. A 14-day reconciler repairs missing or stalled requests without moving the original deadline later. A separate frequent due-date executor performs deletion. A job that runs only every 14 days is not sufficient. Deletion stages retry idempotently. The only retry/state record is never deleted before object storage, database content, and, when applicable, auth deletion are confirmed.

#### Public review (“Today's 10”)
One shared global window opens or rotates at **5:00 PM `America/New_York`** every day. Use the IANA timezone. Never encode EST as a fixed UTC offset. A window contains up to 10 items. Fewer than 10 is valid. Every eligible reviewer sees the same items. A reviewer submits at most once for a given item in a given window.

Public-review eligibility is deny-by-default. Training and benchmark items may be eligible only when provenance, license, and public-display rights are resolved. Collected data may be eligible only after complete anonymization is certified. Unresolved rights mean `admin_only`. Account-linked raw media is not publicly correctable in V1.

Maintain an explicit inventory of training data, benchmark data, collected/user data, and reviewed/exposed data.

Future daily items are randomly preselected into a private lookahead. Bootstrap at least **14** days before enabling public review. Fill to a **28-day** target when eligible inventory permits. Every 14 days, append enough future days to restore a 28-day lookahead. New inventory joins the back of the queue and never displaces already planned days. A source item occupies at most one planned or open day at a time.

If nobody submitted a substantive review by close, return the item to the eligible pool at the back of the queue. If at least one substantive review was submitted, the item is terminal for public review. Confirm and edit are substantive. Skip is not. Report earns zero and quarantines the item for admin review.

Public exposure alone excludes the exposed source and target hashes from all future training and evaluation exports. A planned future item is private and not yet exposed. Record export exclusions when a window opens or the item is first served, whichever occurs first.

When an item is assigned to a planned window, snapshot source text, reference/target text when present, language directions, normalized hashes, provenance, rights state, anonymization state, and original source word count.

#### Review validation and rewards
A daily automated review job calculates and logs a deterministic local cosine-similarity score for each unprocessed substantive submission. For V1 the automated result is always **PASS** regardless of the score. That temporary behavior must stay highly visible in the root README, `automations/README.md`, admin UI, and code comments. Do not add an external AI dependency merely to compute the temporary score.

A human admin may mark a submission unsatisfactory before the window closes. That decision overrides the automatic PASS and prevents its reward. A human late rejection never revokes credits. It creates an admin-visible contributor alert only.

At close, each satisfactory confirm/edit submission receives credits exactly once.

Original source word count, snapshotted at assignment, determines reward:

- 0–20 words: **2 credits**
- 21 or more words: **4 credits**

**One credit = 15 ad-free minutes.** A short review earns 30 ad-free minutes. A long review earns 60 ad-free minutes. Empty or invalid source items are rejected before planning.

There is no top-half, percentile, longest-50-percent, or 1-credit/2-credit corpus-relative reward on the new grant path. Historical ledger rows stay as history. New reward rows carry a rule version and an idempotency key.

A skip earns zero.

#### Advertising
- **Banners:** only idle Translate and idle Learn landing. Never overlap input, keyboard, camera, results, consent, or purchase UI.
- **Automatic interstitial:** eligible after **15 minutes of foreground-active time** since the last confirmed interstitial impression. There is **no per-day maximum**. Reaching 15 minutes sets pending eligibility and does not itself display an ad. Display is allowed only at durable safe points: Translate immediately after Send has committed the input and queued or produced the translation; Camera immediately after a captured photo and its processing task are durably recorded; Learn after a completed learning activity returns to an idle state. Never on launch, resume, tab press, permission flow, error recovery, app exit, while recording, while an edit is unsaved, or while the only copy of user input is transient. A failed or no-fill interstitial does not reset the timer. A confirmed impression resets the timer. SDK-owned dismiss. Remotely disableable.
- **Rewarded video:** explicit user action only. One server-verified, idempotent confirmation grants **2 credits** (30 ad-free minutes). Client-only claims are rejected. Preserve an existing rewarded-ad abuse cap unless a test proves it conflicts; count two-credit rewards correctly.
- TestFlight and internal builds use Google's test ad units and produce **no revenue**. Live revenue requires an App Store production configuration, live AdMob IDs, AdMob readiness, UMP, app-ads.txt, production flags, and valid impressions after release.
- V1 uses contextual/non-personalized ads. Do not request ATT and do not access IDFA. Keep UMP consent-form and privacy-options support.
- Subscription or active earned ad-free time suppresses ads according to entitlement rules.

#### Subscription
Optional. One App Store subscription product with storefront-specific pricing when App Store Connect permits it:

- **USD 2.99/month** for the United States storefront
- **NPR 199/month** for the Nepal storefront

NPR is the ISO currency code. Do not display “NRP.” The app displays StoreKit/RevenueCat's localized price. It never infers storefront from language, IP address, GPS, or device locale. If NPR 199 is not an available Apple price point, stop and ask the owner. Do not approximate.

Sign-in is required before purchase or restore. Translation quality, Camera, speech, and Learn are never paywalled.

#### Admin
One operational console for the public-review window: pre-close unsatisfactory, late rejection, quarantine, contributor alerts, provenance inspection without raw private media. Authorization is server-side. Show the temporary notice that automated cosine review logs a score and always returns PASS.

#### Telemetry
Allowed: crash, performance, anonymous feature/usage, and UI-flow events. Forbidden in telemetry: raw translation text, transcript text, OCR text, photo/audio bytes, file paths, email, auth identifiers, tokens, and other raw user content. Raw speech and photos are contribution content, never analytics payloads. Default to no raw context and no automatic breadcrumbs that capture text fields.

### Feature flags
Recorded at base `034f1cc`. Risky and network features stay **default off** until hosted proof exists. Learn is core and is forced on at runtime even though the bundled default object sets `learnEnabled` false before that override.

| Flag | Client default (`DEFAULT_FEATURE_FLAGS`) | Database default | Until proof |
|------|------------------------------------------|------------------|-------------|
| `contribution_text_enabled` | off | off (local `supabase/seed.sql` turns it on for RPC tests only) | off |
| `contribution_speech_enabled` | off | off | off |
| `contribution_photos_enabled` | off | off | off |
| `rewards_enabled` | off | off | off |
| `network_ads_enabled` | off | off | off |
| `rewarded_ads_enabled` | off | off | off |
| `automatic_interstitial_enabled` | off | off | off |
| `paywall_enabled` | off | off | off |
| `telemetry_enabled` | off | off | off |
| `deletion_processing_enabled` | (server flag) | off | off |
| `learn_enabled` | bundled false; runtime forced true | — | core, on |

`contributions_enabled` is a legacy server column. Local seed sets it true for tests. Production column defaults stay off. There is no separate public-review flag yet; public review stays disabled until the 14-day lookahead gate and hosted proof exist.

Flags must be remote-controllable without an app update. Disabling them must not impair offline Translate, Camera, History, Settings, or Learn.

## V1 scope
- Languages: **English ↔ Nepali only**.
- Surfaces: **Expo iOS / iPadOS** (`mobile/`). Android / Google Play out of scope.
- Inference: on-device STT + on-device MT + on-device Camera OCR. No cloud translation or cloud OCR for the product path.
- Learn V1: Nepali alphabet only.
- Quality gate: exact bundled models must pass the recorded four-class ship evaluation before **public** release. Do not lower thresholds. Translation smoke tests are not certification. Current committed evidence fails English-to-Nepali formal and informal floors.
- Audience: general. 18+ governs contribution features, not the account-free core. Not a Kids category.
- Distribution: internal TestFlight may proceed only under the plan's internal gate, with test ad units, optional server features off, and the model-certification failure called out. Public/external V1 may not ship while a stop-ship gate remains.

## Changed values (decision table)

| Topic | Required value |
|-------|----------------|
| Review credits | 2 if original source words ≤ 20; 4 if ≥ 21. Snapshotted at assignment. |
| Credit duration | 15 ad-free minutes |
| Rewarded ad | 2 credits (30 minutes), server-verified once |
| Review lookahead | Minimum 14 days before enablement; target 28; append every 14 days; never reshuffle |
| Session inactivity | 30 days, rolling; short JWT |
| Interstitial cap | None. 15 minutes foreground-active since last confirmed impression; safe points only |
| Subscription | USD 2.99/month (US); NPR 199/month (Nepal); StoreKit localized price |

## Goals (final contract reconciliation — C0–C15)
- [ ] **C0** Contract rebase and honest baseline
- [ ] **C1** One Today's 10 route; three primary surfaces
- [ ] **C2** Deny-by-default corpus, rights, and anonymization inventory
- [ ] **C3** 14/28-day private lookahead
- [ ] **C4** 2/4-credit rewards and fail-closed export exclusions
- [ ] **C5** Today's 10 reviewer flow and one admin console
- [ ] **C6** First-launch legal acceptance separate from account contribution consent
- [ ] **C7** 30-day rolling authenticated session
- [ ] **C8** Account-linked speech/photo uploads
- [ ] **C9** Idempotent 30-day deletion state machine
- [ ] **C10** USD 2.99 / NPR 199 subscription copy and 2-credit rewarded ads
- [ ] **C11** Interstitial safe points; no daily cap
- [ ] **C12** Telemetry, privacy, dependency triage, repo hygiene
- [ ] **C13** Offline core, Camera correlation, responsive UI, honest model gate
- [ ] **C14** Fresh and upgrade database proof; staging jobs
- [ ] **C15** Full regression and exact-SHA review

Historical F0–F10, G0–G7, and R0–R9 plans remain recorded. Do not reopen them as the ship program. Do not rewrite their evidence to match this contract.

## Constraints
- Must: run fully offline for core translate after models are on device
- Must: ship iOS / iPadOS via Expo/EAS from Windows
- Must: EN↔NE only in product languages
- Must: keep Expo SDK **57** for this release
- Must: server is source of truth for earned rewards; StoreKit/RevenueCat for purchased price and entitlement
- Must: grant new review rewards only as 2 or 4 credits under the word-count rule, exactly once
- Must: keep automated V1 review validation visibly always-PASS while still logging a real local cosine score
- Must: exclude publicly exposed source and target hashes from every train and eval export, fail closed
- Must: delete linked contribution data by the 30-day deadline, with a durable retry record
- Must not: require login or 18+ for guest Translate, Camera, history, Settings, or Learn
- Must not: add a fourth primary tab
- Must not: use a fixed UTC offset for `America/New_York`
- Must not: claw back credits after a late rejection
- Must not: treat an empty exclusion file as proof
- Must not: send raw translations, transcripts, OCR, audio, or photos to telemetry
- Must not: request ATT or IDFA
- Must not: show banners outside idle Translate / idle Learn
- Must not: show automatic interstitials except at the allowlisted safe points
- Must not: treat TestFlight test ads or sandbox IAP as production revenue
- Must not: treat smoke translation tests as four-class model certification
- Must not: edit `benchmarks/gold/` references to raise scores, or train on gold
- Must not: build contributor known checks from gold, training holdouts, or private evaluation answers
- Must not: rewrite historical migrations or falsify old benchmarks
- Must not: put service/secret keys in the app bundle or admin browser code
- Must not: request photo-library permission for the camera translation path
- Must not: display “NRP” or hard-code a Nepal price for a non-Nepal storefront

## Not Doing (this release)
- PC or cloud product MT / OCR
- Android / Google Play ship
- A fourth primary tab
- ATT / IDFA
- Annual, lifetime, or free-trial IAP
- Automatic model training from contributions
- Cash value for credits
- Competing public correction implementations
- Approximating NPR 199 when Apple does not offer that price point

## Definition of Done
Code-owned finalization is complete only when C0–C15 are green on an exact pushed SHA, fresh and upgrade database paths are green, and `.agent/V1_FINAL_CONTRACT_STATE.md` is current. `FINALIZATION_COMPLETE` does not mean App Store, AdMob, hosted production, physical-device, or public V1 gates were completed. Those stay `WAITING_HUMAN` until evidence exists. Public V1 stays blocked while the committed model certificate fails its floors.

## Sensitive areas
- Apple Developer / EAS / App Store Connect credentials and storefront prices (USD 2.99 / NPR 199)
- Supabase project, Apple provider, service role (Edge Functions only), private media buckets
- AdMob / RevenueCat keys and webhooks
- Bundled model weights and the honest failing EN→NE certificate
- Private gold benchmark answers
- Contribution consent, Privacy Policy, Terms, and deletion (legal review required before live collection)
