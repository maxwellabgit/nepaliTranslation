# INTENT
Last updated: 2026-09-21

## North Star
An **offline, on-device iOS / iPadOS app** that translates **English ↔ Nepali** in real time for live conversation and everyday text. Core speech recognition, machine translation, and Camera OCR run on the device. Developed on Windows; shipped via Expo EAS → TestFlight / App Store.

**Optional online services** (account, consented contributions including speech/photo, rewards, ads, subscription, admin, telemetry) may use Supabase, AdMob, and RevenueCat. They must never be required for core translation, Camera, History, Settings, or Nepali alphabet learning. A failure in any optional service must leave the offline core usable.

**Program status:** Foundation through commit `9b17ac9` is a well-tested Windows/source base. Production V1 is the monetized, consented, certified App Store product defined here and delivered by slices **F0–F10** in [`plans/active/beta-release.md`](../plans/active/beta-release.md).

## Product
**NepTranslate** — Nepali-first translation companion.

### Modes (product UI)
1. **Translate** — Typing, speaking, translations, and multi-turn exchange on one screen. Empty state centers a bilingual Speak control. After a turn, Speak and Pass sit at the bottom. Pass flips the active language without leaving the screen. Retry covers the last five turns.
2. **Camera** — On-device photo translation. ML Kit reads Latin and Devanagari on the phone. Temporary capture files are deleted after retake, exit, or successful processing. Guests and non-consenting users never upload Camera media. After versioned contribution consent (18+), eligible captures may upload automatically for model development (see Contributions).
3. **Learn** — Bundled Nepali alphabet (vowels, consonants, common conjuncts) with Apple TTS when a Nepali voice is available. Offline and login-free. Contribution entry is secondary and may prompt for Sign in with Apple only when needed.

### Toggles and UI language
- **Formal** — ON = formal Nepali; OFF = informal. Chosen from the Translate options sheet, not a permanent chip row. Informal = **तिमी**, not तँ.
- **देवनागरी** — ON = Devanagari; OFF = Roman Nepali. Same options sheet.
- **UI language** — Persistent in-app selector: English or नेपाली. Applies to the entire product UI before and after sign-in.

### Platforms
- **iPhone and iPad** are both in V1 scope. Layouts must be proven on phone and tablet size classes; Camera capture/result stays portrait-oriented while chrome stays responsive.

### Optional services (not core)

#### Identity
Supabase Auth + Sign in with Apple. Required only to submit contributions, receive contribution / rewarded-ad rewards, or manage account/deletion. Never required for Translate, Camera, History, Settings, or Learn.

#### Contributions (text, speech, photo)
- Available only to signed-in users who declare they are **18+** and accept **one explicit, versioned contribution-consent screen**.
- Consent must cover speech, photos, transcripts/OCR, edits, model outputs, and relevant technical metadata, including future model development and commercialization, human review, retention, withdrawal, deletion timing, processors, and the fact that core translation works without consent.
- **After consent:** eligible speech recordings and Camera captures **upload automatically** when online. Offline items enter a bounded retry queue and never block core translation. Ordinary guest / non-consenting translations, history, clipboard, and non-consented media remain **local only**.
- Contributed media may be retained **indefinitely until consent withdrawal or account deletion**.
- Withdrawal or account deletion creates an administrator-visible deletion request. All linked raw media, contribution rows, derived rows, and identifiers must be deleted **within 30 days**. The user sees the deadline and later receives completion status.
- Do **not** automatically train a model, alter a benchmark, or export a dataset from submissions. V1 stores contributions and supports manual review/export only.
- **Contributor known checks** are separately curated QC seeds. Never copy them from `benchmarks/gold/`, training holdouts, or private evaluation answers.

#### Rewards
- Server-authoritative credits → earned ad-free time. Client never creates ledger entries.
- **One credit = five ad-free minutes.**
- Every submitted row stores an immutable pre-edit source snapshot and `original_word_count`.
- Source with **more than 20 words** before editing → **two credits**; otherwise **one**. Editing after submit does not change the scheduled credit value.
- Reward window closes daily at **5:00 PM `America/New_York`** (DST-aware). At close, approved or still-unreviewed rows receive scheduled credits **exactly once**. Pre-deadline rejection prevents reward.
- **No credit clawback:** rejection after credits were granted never revokes credits or shortens earned ad-free time. Create a contributor alert for manual review only. No automatic throttle, suspend, or punishment.

#### Advertising
- **Banners:** only while Translate is idle/empty and on the Learn landing screen. Never during typing, listening, speaking, translation, Camera, pass-the-phone, correction, quiz, account, subscription, or result-review.
- **Automatic interstitial:** eligible after **15 minutes** of foreground-active use, capped at **three per `America/New_York` calendar day**, only at a natural idle transition after the user completed and left a task. Never on launch, exit, resume, tab press, permission flow, error recovery, Camera, or while a result is still under review. **AdMob SDK** owns presentation and dismissal — no custom skip UI. Remotely disableable; remains **off** until physical-device and external-beta gates pass.
- **Rewarded video:** opt-in only. Verified completion grants **15 ad-free minutes** (SSV-authoritative).
- Offline → bundled house ad only; never call the ad network offline. Contextual / non-personalized ads are the V1 default. No ATT/IDFA in this release.
- Subscription or active earned ad-free window suppresses banners, automatic interstitials, and house ads.

#### Subscription
- One auto-renewing product: **NepTranslate Ad-Free — US $0.99/month** (Apple-localized storefront equivalents).
- Removes every ad format. No annual, lifetime, consumable currency, or free trial required for V1.
- Restore Purchases, Manage Subscription, expired / billing-retry states, offline entitlement caching, and account-deletion messaging (Apple billing may continue) are required.
- Translation quality, Camera, speech, and Learn are **never** paywalled. Authoritative price comes from StoreKit, not a hard-coded string.

#### Admin
Small protected web console for review, alerts, deletion queue, dataset staging (manual export only), and feature flags. No service key in browser code.

#### Telemetry
Crash, performance, anonymous feature / usage / UI-flow events are permitted. **Raw text, audio, transcripts, OCR, and photos must not** enter third-party analytics or crash payloads — only the first-party contribution pipeline under contribution consent.

### Feature flags (independent; defaults off until gates pass)
| Flag | Controls |
|------|----------|
| `contribution_text_enabled` | Text contribution / correction upload |
| `contribution_speech_enabled` | Post-consent speech media upload |
| `contribution_photos_enabled` | Post-consent Camera media upload |
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
- Quality gate: private **gold standard** set (~100 high-quality samples per eval class: formal EN→NE, informal EN→NE, NE→EN Devanagari, Roman NE→EN). Exact bundled models must pass recorded four-class ship evaluation before release.
- Audience: general; contribution collection requires **18+**. App is not Kids category. No citizenship checks.
- Distribution: development builds → internal TestFlight → external TestFlight (25–50 bilingual) → public App Store. No “beta,” “test,” or unfinished language in public App Store metadata.

## Goals (Production V1 finalization — F0–F10)
- [ ] **F0** Durable product contract matches this INTENT (docs only)
- [ ] **F1** STT privacy, raw-log scrub, pinned model hashes, Camera stability
- [ ] **F2** Bilingual UI, dark mode, accessibility, iPhone + iPad layouts
- [ ] **F3** Consented speech/photo ingestion and private storage
- [ ] **F4** 5 PM New York reward close, alerts, 30-day deletion jobs
- [ ] **F5** Banners, interstitials, rewarded ads, full ad-policy tests
- [ ] **F6** RevenueCat / StoreKit $0.99 subscription
- [ ] **F7** Protected operational admin console
- [ ] **F8** Telemetry, legal/store surfaces, security, dependency triage
- [ ] **F9** Exact model certification + extended Windows automation
- [ ] **F10** Device matrix, TestFlight, App Store release gates

## Constraints
- Must: run fully offline for core translate after models are on device
- Must: ship iOS / iPadOS via Expo/EAS from Windows (no Mac required day-to-day)
- Must: EN↔NE only in product languages
- Must: keep Expo SDK **57** for this release (no combined Expo upgrade)
- Must: server is source of truth for earned rewards; RevenueCat/StoreKit for purchased subscription
- Must: AdMob SDK control interstitial dismissal; automatic interstitial remotely disableable
- Must: 30-day deletion of all linked personal contribution data after withdrawal or account deletion
- Must not: require login, ads, contribution, or payment for core translation or alphabet lessons
- Must not: require a PC, tunnel, or cloud API for translation/STT/OCR in the product path
- Must not: put Supabase service keys, RevenueCat secret keys, AdMob secrets, webhook secrets, or admin credentials in the app bundle
- Must not: upload contribution media for guests, under-18, declined/outdated consent, signed-out, or flag-off states
- Must not: send raw translations, transcripts, or photos to third-party analytics
- Must not: request photo-library permission for the camera translation path (unless a later import feature is added)
- Must not: trust the client to create credits, extend ad-free time, change trust, or mark corrections valid
- Must not: claw back credits after a late rejection
- Must not: use model similarity alone as proof of correctness
- Must not: edit `benchmarks/gold/` references to raise scores, or use gold as contributor known checks
- Must not: show banners outside idle Translate / Learn landing; must not show automatic interstitials outside policy; must not invent a custom interstitial skip control

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

## Definition of Done (product coherence + V1 readiness)
- Docs and INTENT describe offline core + optional online services with the boundaries above
- App keeps Translate (including pass-the-phone) + on-device Camera + offline Learn on iPhone and iPad
- Feature flags can independently disable text/speech/photo contributions, banners, rewarded ads, automatic interstitial, paywall, telemetry, and deletion processing without an app update
- Release Definition of Done in `.agent/DONE.md` (F0–F10 + go/no-go) is fully checked before public submission

## Sensitive areas
- Apple Developer / EAS / App Store Connect credentials and IAP pricing ($0.99/month)
- Supabase project, Apple provider, service role (Edge Functions only), private media buckets
- AdMob / RevenueCat keys and webhooks
- Bundled model weights, pinned revisions, and SHA-256 manifests
- Private gold benchmark answers (do not publish; do not reuse as contributor known checks)
- Contribution agreement (18+, media), Privacy Policy, Terms, deletion/retention (legal review required before live collection / dataset use)
