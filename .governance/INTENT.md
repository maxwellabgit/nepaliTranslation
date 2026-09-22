# INTENT
Last updated: 2026-09-22

## North Star
An **offline, on-device iOS / iPadOS app** that translates **English ↔ Nepali** in real time for live conversation and everyday text. Core speech recognition, machine translation, and Camera OCR run on the device. Developed on Windows; shipped via Expo EAS → TestFlight / App Store.

**Optional online services** (account, consented contributions including photo + public review, rewards, ads, subscription, admin, telemetry) may use Supabase, AdMob, and RevenueCat. They must never be required for core translation, Camera, History, Settings, or Nepali alphabet learning. A failure in any optional service must leave the offline core usable.

**Program status:** Foundation through `9b17ac9` and source slices **F0–F10** (tip `43f9bc6`) are **not** ship-ready. A 2026-09-22 TestFlight finalization audit found blocking gaps in ads SDK contracts, RevenueCat identity, public-review pool, consent/deletion truthfulness, model/device certification, and hosted schedulers. Production V1 readiness is delivered by remediation gates **G0–G7** in [`plans/active/v1-testflight-finalization.md`](../plans/active/v1-testflight-finalization.md). Contract freeze: [`.governance/V1_G0_DECISIONS.md`](./V1_G0_DECISIONS.md).

## Product
**NepTranslate** — Nepali-first translation companion.

### Modes (product UI)
1. **Translate** — Typing, speaking, translations, and multi-turn exchange on one screen. Empty state centers a bilingual Speak control. After a turn, Speak and Pass sit at the bottom. Pass flips the active language without leaving the screen. Retry covers the last five turns.
2. **Camera** — On-device photo translation. ML Kit reads Latin and Devanagari on the phone. Temporary capture files are deleted after retake, exit, or successful processing. Guests and non-consenting users never upload Camera media. After versioned contribution consent (18+), eligible **photo** captures may upload automatically for model [REDACTED] when flags allow (see Contributions).
3. **Learn** — Bundled Nepali alphabet (vowels, consonants, common conjuncts) with Apple TTS when a Nepali voice is available. Offline and login-free. Contribution / public-review entry is secondary and may prompt for Sign in with Apple only when needed.
4. **Review (optional, signed-in)** — Up to **ten** public correction opportunities per eligible reviewer per `America/New_York` review day (closes 5:00 PM). Copy must say **“up to 10 available today,”** never a guaranteed ten. See Public review pool.

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

**Never required for:** Translate, Camera, History, Settings, or Learn.

RevenueCat `app_user_id` must be the signed-in **Supabase UUID** before paywall or restore. Anonymous RevenueCat IDs are not a V1 purchase path (Gate 3).

#### Contributions (text / public review, photo; speech media deferred)
- Available only to signed-in users who declare they are **18+** and accept **one explicit, versioned, bilingual contribution-consent screen**.
- Consent must cover photos (when enabled), transcripts/OCR where applicable, edits, model outputs, public-review corrections, relevant technical metadata, future model [REDACTED] and commercialization, human review, retention, **withdrawal**, deletion timing, processors, and the fact that core translation works without consent.
- **V1 media upload scope:** eligible **Camera photos** may **upload automatically** after consent when `contribution_photos_enabled` is on. Offline items enter a bounded retry queue and never block core translation.
- **Raw speech-media upload does not ship in V1 disclosures.** On-device STT for live translation stays local. Flag `contribution_speech_enabled` defaults off and must not be claimed in legal/permission copy until capture URI + upload + purge are proven (Gate 2).
- Ordinary guest / non-consenting translations, history, clipboard, microphone audio, and non-consented photos remain **local only**.
- Contributed media may be retained **indefinitely until consent withdrawal or account deletion**.
- Withdrawal or account deletion creates an administrator-visible deletion request. **All** linked raw media, contribution rows, derived rows, and identifiers must be deleted **within 30 days**. The user sees the deadline and later receives completion status.
- Do **not** automatically train a model, alter a benchmark, or export a dataset from submissions without the eligibility rules below. V1 stores contributions and supports manual review/export only under those rules.
- **Contributor known checks** are separately curated **synthetic** QC seeds. Never copy them from `benchmarks/gold/`, training holdouts, or private evaluation answers. They do not consume the daily public-review ten.

#### Public review pool
- Import every licensed, de-identified, deduplicated training/candidate/source record marked `public_review_eligible` (see [`.governance/DATA_CLASSIFICATION.md`](./DATA_CLASSIFICATION.md)).
- **Exclude** frozen benchmarks and copies, license holds, PII/sensitive rows, and duplicates. Exclusions enforced in DB views/export jobs + CI.
- Allocate with an **exclusive lease** (`FOR UPDATE SKIP LOCKED`). Expired lease may reopen; completed review **retires the sample globally**.
- Skip may go to someone else but must not return to the same user that day. Report → quarantine.
- On submission, atomically set `public_review_eligible=false`, `training_eligible=false`, `benchmark_eligible=false`.
- Credits: one credit = five ad-free minutes; original source **>20 words** at assignment → **two** credits; else one. If admins have not decided by **5:00 PM America/New_York**, grant scheduled credits **exactly once**. **Never claw back.** Late rejection → manual contributor alert only.

#### Rewards
- Server-authoritative credits → earned ad-free time. Client never creates ledger entries.
- **One credit = five ad-free minutes.**
- Every submitted row stores an immutable pre-edit source snapshot and `original_word_count`.
- Source with **more than 20 words** before editing → **two credits**; otherwise **one**. Editing after submit does not change the scheduled credit value.
- Reward window closes daily at **5:00 PM `America/New_York`** (DST-aware). At close, approved or still-unreviewed rows receive scheduled credits **exactly once**. Pre-deadline rejection prevents reward.
- **No credit clawback:** rejection after credits were granted never revokes credits or shortens earned ad-free time. Create a contributor alert for manual review only. No automatic throttle, suspend, or punishment.
- Hosted **5:00 PM** credit processor and **30-day** deletion processor must be **provisioned and monitored** (Gate 5) — endpoint code alone is insufficient.

#### Advertising
- **Banners:** only while Translate is idle/empty and on the Learn landing screen. Never during typing, listening, speaking, translation, Camera, pass-the-phone, correction, quiz, account, subscription, or result-review.
- **Automatic interstitial:** eligible after **15 minutes of foreground-active time since the last successful interstitial impression**, capped at **three per `America/New_York` calendar day**, only at a natural idle transition after the user completed and left a task (including safe post-result / post-lesson opportunities). Never on launch, exit, resume, tab press, permission flow, error recovery, Camera, or while a result is still under review. **AdMob SDK** owns presentation and dismissal — no custom skip UI. Remotely disableable; remains **off** until physical-device and external-beta gates pass. Quota updates only after a **confirmed impression**.
- **Rewarded video:** opt-in only. Verified completion grants **15 ad-free minutes** (SSV-authoritative). Loading must use the installed SDK’s real event contract (not a false Promise from `load()`).
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
Small protected web console for public-review adjudication (pending-before-close, accept/reject/quarantine), alerts, deletion queue, pool inventory/runway, dataset staging (manual export only under eligibility views), and feature flags. No service key in browser code.

#### Telemetry
Crash, performance, anonymous feature / usage / UI-flow events are permitted. **Raw text, audio, transcripts, OCR, and photos must not** enter third-party analytics or crash payloads — only the first-party contribution pipeline under contribution consent.

### Feature flags (independent; defaults off until gates pass)
| Flag | Controls |
|------|----------|
| `contribution_text_enabled` | Text / public-review contribution upload |
| `contribution_speech_enabled` | Post-consent speech media upload (**deferred claim; stay off**) |
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
- Audience: general; contribution collection requires **18+**. App is not Kids category. No citizenship checks.
- Distribution: diagnostic internal TestFlight (optional features off) → evidence gates G1–G6 → small external cohort ≥ seven stable days → public App Store. No “beta,” “test,” or unfinished language in public App Store metadata.

## Goals (TestFlight finalization — G0–G7)
- [x] **G0** Freeze product contract (docs only) — this INTENT + V1_G0_DECISIONS + DATA_CLASSIFICATION
- [ ] **G1** Real public-review pool, importer, exclusive allocation, admin adjudication, 5 PM grants
- [ ] **G2** Truthful bilingual consent, withdrawal, 30-day purge of all linked data
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
- Must: 30-day deletion of all linked personal contribution data after withdrawal or account deletion
- Must: require sign-in before purchase, restore, and contribution
- Must: treat “up to 10” public reviews per reviewer per NY day as the cardinality
- Must not: require login, ads, contribution, or payment for core translation or alphabet lessons
- Must not: require a PC, tunnel, or cloud API for translation/STT/OCR in the product path
- Must not: put Supabase service keys, RevenueCat secret keys, AdMob secrets, webhook secrets, or admin credentials in the app bundle
- Must not: upload contribution media for guests, under-18, declined/outdated consent, signed-out, or flag-off states
- Must not: claim raw speech-media auto-upload in V1 disclosures while `contribution_speech_enabled` is deferred
- Must not: send raw translations, transcripts, or photos to third-party analytics
- Must not: request photo-library permission for the camera translation path (unless a later import feature is added)
- Must not: trust the client to create credits, extend ad-free time, change trust, or mark corrections valid
- Must not: claw back credits after a late rejection
- Must not: use model similarity alone as proof of correctness
- Must not: edit `benchmarks/gold/` references to raise scores, or use gold as contributor known checks
- Must not: expose active frozen benchmarks for public correction
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
- Guaranteed ten public reviews every day regardless of pool inventory
- Raw speech-media contribution as a V1 legal promise (deferred)

## Definition of Done (product coherence + V1 readiness)
- Docs and INTENT describe offline core + optional online services with the boundaries above
- App keeps Translate (including pass-the-phone) + on-device Camera + offline Learn on iPhone and iPad
- Feature flags can independently disable text/speech/photo contributions, banners, rewarded ads, automatic interstitial, paywall, telemetry, and deletion processing without an app update
- Release Definition of Done in `.agent/DONE.md` (G0–G7 + go/no-go) is fully checked before public submission
- Diagnostic internal TestFlight may proceed with optional features off; external RC requires G0–G7 evidence

## Sensitive areas
- Apple Developer / EAS / App Store Connect credentials and IAP pricing ($0.99/month)
- Supabase project, Apple provider, service role (Edge Functions only), private media buckets
- AdMob / RevenueCat keys and webhooks
- Bundled model weights, pinned revisions, and SHA-256 manifests
- Private gold benchmark answers (do not publish; do not reuse as contributor known checks or public review)
- Contribution agreement (18+, media), Privacy Policy, Terms, deletion/retention (legal review required before live collection / dataset use)
