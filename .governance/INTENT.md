# INTENT
Last updated: 2026-09-22 (amended per owner directive)

## North Star
An **offline, on-device iOS / iPadOS app** that translates **English ↔ Nepali** in real time for live conversation and everyday text. Core speech recognition, machine translation, and Camera OCR run on the device. Developed on Windows; shipped via Expo EAS → TestFlight / App Store.

**Optional online services** (account, consented contributions including speech + photo + public-review corrections, rewards, ads, subscription, admin, telemetry) may use Supabase, AdMob, and RevenueCat. They must never be required for core translation, Camera, History, Settings, or Nepali alphabet learning. A failure in any optional service must leave the offline core usable.

**Program status:** Foundation through `9b17ac9` and source slices **F0–F10** (tip `43f9bc6`) are **not** ship-ready. A 2026-09-22 TestFlight finalization audit found blocking gaps in ads SDK contracts, RevenueCat identity, public-review pool, consent/deletion truthfulness, model/device certification, and hosted schedulers. Production V1 readiness is delivered by remediation gates **G0–G7** in [`plans/active/v1-testflight-finalization.md`](../plans/active/v1-testflight-finalization.md). Contract freeze: [`.governance/V1_G0_DECISIONS.md`](./V1_G0_DECISIONS.md).

## Product
**NepTranslate** — Nepali-first translation companion.

### Startup consent gate
On first launch and after any consent-version bump, every user (guest or signed-in) must acknowledge, before reaching any product surface:

1. Terms & Conditions (checkbox)
2. Privacy Policy (checkbox) — disclosing optional speech, photo, and correction upload after sign-in; retention until withdrawal / account deletion; 30-day purge SLA; contextual ads
3. "I am 18 years of age or older" (checkbox)

If any is unchecked, the app stays on the consent screen. Consent is stored locally; on sign-in it is mirrored to `user_consents` and re-affirmed on version bump. Guests may translate locally without login but cannot upload anything.

### Modes (product UI)
1. **Translate** — Typing, speaking, translations, and multi-turn exchange on one screen. Empty state centers a bilingual Speak control. After a turn, Speak and Pass sit at the bottom. Pass flips the active language without leaving the screen. Retry covers the last five turns.
2. **Camera** — On-device photo translation. ML Kit reads Latin and Devanagari on the phone. Temporary capture files are deleted after retake, exit, or successful processing. Guests never upload Camera media. After sign-in + startup consent, eligible photo captures may upload automatically when `contribution_photos_enabled` is on.
3. **Learn** — Bundled Nepali alphabet (vowels, consonants, common conjuncts) with Apple TTS when a Nepali voice is available. Offline and login-free. Contribution / public-review entry is secondary.
4. **Review (optional, signed-in)** — **Today's 10 corrections** — a single global set of ten randomly selected corpus items per America/New_York review day. All eligible signed-in reviewers see the same ten. The window rotates at 5:00 PM America/New_York; credits for that window's submissions grant at close. Copy: "Today's 10 corrections" (shared pool).

### Toggles and UI language
- **Formal** — ON = formal Nepali; OFF = informal. Chosen from the Translate options sheet, not a permanent chip row. Informal = **तिमी**, not तँ.
- **देवनागरी** — ON = Devanagari; OFF = Roman Nepali. Same options sheet.
- **UI language** — Persistent in-app selector: English or नेपाली. Applies to the entire product UI before and after sign-in.

### Platforms
- **iPhone and iPad** are both in V1 scope. Layouts must be proven on phone and tablet size classes; Camera capture/result stays portrait-oriented while chrome stays responsive.

### Optional services (not core)

#### Identity
Supabase Auth + Sign in with Apple.

**Required before:** subscription purchase, Restore Purchases, public review / contribution submission, and contribution / rewarded-ad reward redemption flows that need an account.

**Never required for:** Translate, Camera, History, Settings, or Learn (subject only to the startup consent gate).

RevenueCat `app_user_id` must be the signed-in **Supabase UUID** before paywall or restore. Anonymous RevenueCat IDs are not a V1 purchase path (Gate 3).

#### Contributions (text, speech, photo, corrections) — account-linked
- Available only to signed-in users who have completed the startup consent gate (T&C + Privacy + 18+).
- **All V1 optional-service data is tied to the signed-in user's `user_id`.** This includes text/speech/photo contributions, translation submissions, public-review corrections, and derived rows.
- Consent scope: photos (when enabled), raw speech recordings (when `contribution_speech_enabled` on), transcripts/OCR where applicable, edits, model outputs, public-review corrections, relevant technical metadata; retention indefinite until withdrawal/deletion; **30-day purge** on withdrawal or account deletion, with admin alert and user-visible status.
- Guests / signed-out users **never** upload anything.
- Do **not** automatically train a model, alter a benchmark, or export a dataset from submissions without the D2 verification migration. V1 stores contributions for later manual review/export only.
- **Contributor known checks** are separately curated **synthetic** QC seeds. Never copy them from `benchmarks/gold/`, training holdouts, or private evaluation answers.

#### Public review pool (global 10/day)
- Import every row under `datasets/`, `training/`, and `benchmarks/` into `review_source_items` (de-identify, dedupe, record license). Mark `public_review_eligible=true` unless PII-flagged. See [`.governance/DATA_CLASSIFICATION.md`](./DATA_CLASSIFICATION.md).
- At each 5:00 PM America/New_York rotation, the scheduler closes the current window, grants credits, pre-selects 10 new random items, and publishes them.
- Every eligible signed-in reviewer sees the **same 10** items. One submission per item per user per window; multiple users may submit corrections for the same item.
- **Length-tier credit** (snapshotted at assignment): items in the top 50% of the corpus by source character length earn 2 credits; the rest earn 1 credit.
- **1 credit = 15 minutes ad-free.**
- Admin marking a submission `unsatisfactory` **before close** → that submission earns zero credits at close.
- No submission is used to change training or evaluation until a separate future verification step.

#### Rewards
- Server-authoritative credits → earned ad-free time. Client never creates ledger entries.
- **One credit = 15 minutes ad-free.** Rewarded video granting is one credit.
- Every submitted row stores an immutable pre-edit source snapshot, `original_word_count`, and the length-tier used at assignment.
- Credit grant runs **exactly once** per window at the 5:00 PM America/New_York rotation (DST-aware).
- Submissions marked unsatisfactory by admin before close → zero credits.
- **No credit clawback:** post-close rejection creates a contributor alert only.
- Hosted **5:00 PM** rotation processor and **30-day** deletion processor must be **provisioned and monitored** (Gate 5) — endpoint code alone is insufficient.

#### Advertising
- **Banners:** only while Translate is idle/empty and on the Learn landing screen. Never during typing, listening, speaking, translation, Camera, pass-the-phone, correction, quiz, account, subscription, or result-review.
- **Automatic interstitial:** eligible after **15 minutes of foreground-active time since the last successful interstitial impression**, capped at **three per `America/New_York` calendar day**, only at a natural idle transition after the user completed and left a task (including safe post-result / post-lesson opportunities). Never on launch, exit, resume, tab press, permission flow, error recovery, Camera, or while a result is still under review. **AdMob SDK** owns presentation and dismissal — no custom skip UI. Remotely disableable; remains **off** until physical-device and external-beta gates pass. Quota updates only after a **confirmed impression**.
- **Rewarded video:** opt-in only. Verified completion grants **15 ad-free minutes** (1 credit; SSV-authoritative). Loading must use the installed SDK's real event contract (not a false Promise from `load()`).
- Offline → bundled house ad only; never call the ad network offline. Contextual / non-personalized ads are the V1 default. No ATT/IDFA in this release.
- Subscription or active earned ad-free window suppresses banners, automatic interstitials, and house ads.
- **TestFlight and internal builds use Google test ad units.** Live revenue additionally requires production unit IDs, consent handling, AdMob readiness, and `app-ads.txt`. Test impressions are not revenue proof.

#### Subscription
- One auto-renewing product: **NepTranslate Ad-Free — US $0.99/month** (Apple-localized storefront equivalents).
- Removes every ad format. No annual, lifetime, consumable currency, or free trial required for V1.
- **Sign-in required** before purchase or restore. Restore Purchases, Manage Subscription, expired / billing-retry states, offline entitlement caching, and account-deletion messaging (Apple billing may continue) are required.
- Certify purchase, restore, cancellation, refund/revocation, reinstall, and second-device cases before enabling `paywall_enabled` in production-like builds (Gate 3). TestFlight RevenueCat transactions are sandbox, not real revenue.
- Translation quality, Camera, speech, and Learn are **never** paywalled. Authoritative price comes from StoreKit, not a hard-coded string.

#### Admin
Small protected web console for public-review adjudication (mark unsatisfactory before close, view submissions), alerts, deletion queue, pool inventory/runway, dataset staging (manual export only under eligibility views), and feature flags. No service key in browser code.

#### Telemetry
Crash, performance, anonymous feature / usage / UI-flow events are permitted. **Raw text, audio, transcripts, OCR, and photos must not** enter third-party analytics or crash payloads — only the first-party contribution pipeline under contribution consent.

### Feature flags (independent; defaults off until gates pass)
| Flag | Controls |
|------|----------|
| `contribution_text_enabled` | Text / public-review contribution upload |
| `contribution_speech_enabled` | Post-consent speech media upload (V1 in scope; default off until Gate 2 proof) |
| `contribution_photos_enabled` | Post-consent Camera photo upload |
| `network_ads_enabled` | Network banner requests |
| `rewarded_ads_enabled` | Opt-in rewarded video |
| `automatic_interstitial_enabled` | Automatic interstitial (launch-testing gated) |
| `paywall_enabled` | Subscription paywall / purchase flows |
| `telemetry_enabled` | Crash / performance / product analytics |
| `deletion_processing_enabled` | Server deletion jobs / purge processing |

Flags must be remote-controllable without an app update. Disabling optional flags must not impair offline Translate, Camera, History, Settings, or Learn.

## V1 scope
- Languages: **English ↔ Nepali only**.
- Surfaces: **Expo iOS / iPadOS** (`mobile/`). Android / Google Play out of scope for this release.
- Inference: on-device STT + on-device MT + on-device Camera OCR for the product path. No cloud translation for core. Contribution upload is optional and must not become a dependency for translation.
- STT must request **on-device recognition** and fail closed when English/Nepali on-device locales are unavailable; typed translation remains available.
- Learn V1: Nepali alphabet only — no English course, streak economy, or broad curriculum.
- Quality gate: private **gold standard** set (~100 high-quality samples per eval class: formal EN→NE, informal EN→NE, NE→EN Devanagari, Roman NE→EN). Exact bundled models must pass recorded four-class ship evaluation before release. Soft CI when weights are missing is **not** certification.
- Audience: general adult (**18+** startup gate); contribution collection requires 18+ acceptance. App is not Kids category. No citizenship checks.
- Distribution: diagnostic internal TestFlight (optional features off) → evidence gates G1–G6 → small external cohort ≥ seven stable days → public App Store. No "beta," "test," or unfinished language in public App Store metadata.

## Goals (TestFlight finalization — G0–G7)
- [ ] **G0** Freeze product contract (docs only) — INTENT + V1_G0_DECISIONS + DATA_CLASSIFICATION (merge after independent review)
- [ ] **G1** Real global-10 public-review pool, importer of all corpora, 5 PM rotation, admin adjudication
- [ ] **G2** Startup consent gate (T&C + Privacy + 18+), account-linked collection, raw speech + photo upload, withdrawal, 30-day purge
- [ ] **G3** Ads SDK event contracts, impression-based interstitial timer, RevenueCat↔Supabase identity
- [ ] **G4** Exact ONNX fetch/hash/four-class eval + physical iPhone/iPad proof
- [ ] **G5** Hosted scheduler, secrets, legal URLs, telemetry, backups, kill switches
- [ ] **G6** Internal TestFlight candidate with staged flag enablement
- [ ] **G7** External cohort ≥ seven stable days + V1 go/no-go

Prior F0–F10 source slices remain historical foundation; do not reopen them as the ship program.

## Constraints
- Must: run fully offline for core translate after models are on device
- Must: ship iOS / iPadOS via Expo/EAS from Windows (no Mac required day-to-day)
- Must: EN↔NE only in product languages
- Must: keep Expo SDK **57** for this release (no combined Expo upgrade)
- Must: server is source of truth for earned rewards; RevenueCat/StoreKit for purchased subscription
- Must: AdMob SDK control interstitial dismissal; automatic interstitial remotely disableable
- Must: 30-day deletion of all linked personal contribution data after withdrawal or account deletion; every collected row tied to `user_id`
- Must: require sign-in before purchase, restore, and contribution
- Must: require startup T&C + Privacy Policy + 18+ acknowledgement before any product surface
- Must: publish exactly one global 10-item review window per NY day, rotating at 5:00 PM
- Must: grant credits at close; 1 credit = 15 minutes; top-50%-longest = 2 credits
- Must not: require login for core translation, camera, history, settings, or Learn (only the startup consent gate is required)
- Must not: require a PC, tunnel, or cloud API for translation/STT/OCR in the product path
- Must not: put Supabase service keys, RevenueCat secret keys, AdMob secrets, webhook secrets, or admin credentials in the app bundle
- Must not: upload contribution media for guests, signed-out, declined consent, or flag-off states
- Must not: send raw translations, transcripts, or photos to third-party analytics
- Must not: request photo-library permission for the camera translation path (unless a later import feature is added)
- Must not: trust the client to create credits, extend ad-free time, change trust, or mark corrections valid
- Must not: claw back credits after a late rejection
- Must not: use model similarity alone as proof of correctness
- Must not: automatically promote review submissions into `benchmarks/gold/` or training corpora without a separate verified migration
- Must not: show banners outside idle Translate / Learn landing; must not show automatic interstitials outside policy; must not invent a custom interstitial skip control
- Must not: treat TestFlight test ads or sandbox IAP as production revenue proof
- Must not: treat soft model-cert CI (missing weights) as four-class certification

## Not Doing (this release)
- PC hybrid Whisper/IndicTrans2 servers / cloud product MT
- Web/Safari demo as a product surface
- Cloud OCR as the product Camera path
- Hindi or other Nepal languages as product languages
- Smart glasses / Brilliant Halo
- Swift-only rewrite (Expo is the app shell; native modules OK for inference)
- Android / Google Play ship
- English Learn curriculum, streaks, levels
- Cash value / transfers / withdrawals for contribution credits
- Automatic model training or automatic benchmark modification from contributions
- Citizenship detector or App Store country as a citizenship claim
- ATT / IDFA in this release (contextual / non-personalized ads; declare SDK collection accurately)
- Annual / lifetime IAP or free trial for V1
- Per-reviewer daily quota for the public-review pool (V1 uses a global 10/day)

## Definition of Done (product coherence + V1 readiness)
- Docs and INTENT describe offline core + optional online services with the boundaries above
- App keeps Translate (including pass-the-phone) + on-device Camera + offline Learn on iPhone and iPad
- Feature flags can independently disable text/speech/photo contributions, banners, rewarded ads, automatic interstitial, paywall, telemetry, and deletion processing without an app update
- Release Definition of Done in `.agent/DONE.md` (G0–G7 + go/no-go) is fully checked before public submission
- Diagnostic internal TestFlight may proceed with optional features off; external RC requires G0–G7 evidence

## Sensitive areas
- Apple Developer / EAS / App Store Connect credentials and IAP pricing ($0.99/month)
- Supabase project, Apple provider, service role (Edge Functions only), private media buckets for photos and speech recordings
- AdMob / RevenueCat keys and webhooks
- Bundled model weights, pinned revisions, and SHA-256 manifests
- Private gold benchmark answers (imported into review pool per D2, but must not be promoted back to training/eval automatically)
- Startup consent agreement (T&C, Privacy, 18+), Privacy Policy, Terms, deletion/retention (legal review required before live collection / dataset use)
