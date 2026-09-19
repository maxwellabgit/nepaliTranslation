# INTENT
Last updated: 2026-09-19

## North Star
An **offline, on-device iOS app** that translates **English ↔ Nepali** in real time for live conversation and everyday text. All speech recognition and translation for the core loop run on the iPhone. Developed on Windows; shipped to iPhone via Expo EAS → TestFlight / App Store.

**Optional online services** (account, contributions, rewards, ads, subscription, admin) may use Supabase, AdMob, and RevenueCat. They must never be required for core translation, Conversation, History, Settings, or Nepali alphabet learning. A failure in any optional service must leave the offline core usable.

## Product
**NepTranslate** — Nepali-first translation companion.

### Modes (product UI)
1. **Translate (Auto)** — Type or speak (equal prominence). Auto-detect Nepali or English; translate to the other language.
2. **Conversation** — Pass the phone. Speak with longer continuous listening; tap **Pass** / **पास** to finalize translation and flip to the other side. Chat bubbles; retry last turns.
3. **Learn** — Bundled Nepali alphabet (vowels, consonants, common conjuncts) with Apple TTS when a Nepali voice is available. Offline and login-free. Contribution entry is secondary and may prompt for Sign in with Apple only when needed.

### Toggles (light switches)
- **Formal** — ON = formal Nepali; OFF = informal.
- **देवनागरी** — ON = Devanagari; OFF = Roman Nepali (Auto always; Conversation on Nepali side).

### Optional services (not core)
- **Identity** — Supabase Auth + Sign in with Apple. Required only to submit contributions or receive contribution / rewarded-ad rewards.
- **Contributions** — Explicit per-item review, versioned consent, 13+ confirmation, then upload. Never auto-upload ordinary translation history, audio, transcripts, or clipboard.
- **Rewards** — Server-authoritative credits → earned ad-free time. Client never creates ledger entries.
- **Ads** — Google AdMob banners only when no subscription and no earned ad-free window; rewarded video is always opt-in. Offline → bundled house ad only; never call the ad network offline.
- **Subscription** — Optional ad-free auto-renewing IAP (U.S. target `$0.49/month`). Not required for translation or Learn.
- **Admin** — Small protected web console; no service key in browser code.

## V1 / beta scope
- Languages: **English ↔ Nepali only** (NPHC 2021: Nepali is the national lingua franca; Maithili/Bhojpuri etc. are later).
- Surfaces: **Expo iOS app** (`mobile/`) first. Android / Google Play are out of scope for this release.
- Inference: on-device STT + on-device MT for the product translate path. No cloud translation; no model-family change in the App Store beta program.
- Learn beta: Nepali alphabet only — no English course, streak economy, or broad curriculum.
- Output: text (+ optional TTS). No camera / OCR in this release.
- Quality gate: private **gold standard** set — ~100 high-quality samples per eval class (formal EN→NE, informal EN→NE, NE→EN Devanagari, Roman NE→EN).
- **Contributor known checks** are a separately curated quality-control set. They must **never** be copied from `benchmarks/gold/`, training holdouts, or private evaluation answers.
- Audience: general, target 13+ (not Kids category). No citizenship checks or nationality claims.
- Distribution sequence: development builds → internal TestFlight → external TestFlight → public App Store release candidate. Do not put “beta,” “test,” or unfinished language in public App Store metadata.

## Goals (this iteration — App Store / TestFlight beta)
- [x] Single coherent offline product story for core translate
- [x] Auto + Conversation UI; Formal / देवनागरी toggles
- [x] Gold-standard benchmark scaffold + curation guide
- [ ] Durable beta release lane (ExecPlan + DONE gates) — Slice 00
- [ ] Test harness before feature work — Slice 01
- [ ] Remove temporary review-sync endpoint/secret and password Meaning Review from production path
- [ ] Supabase schema/RLS + Apple identity + consent + deletion
- [ ] Honest correction sheet + offline outbox (no silent legacy upload)
- [ ] Contribution queue with hidden known checks + consensus (server-side)
- [ ] Reward ledger + entitlement + ad policy + AdMob + RevenueCat subscription
- [ ] Learn alphabet (offline) + protected admin console
- [ ] Privacy / store surfaces + E2E + TestFlight / App Store release

## Constraints
- Must: run fully offline for core translate after models are on device
- Must: ship iOS via Expo/EAS from Windows (no Mac required day-to-day)
- Must: EN↔NE only in product languages
- Must: keep Expo SDK **57** for this release (no combined Expo upgrade)
- Must: server is source of truth for earned rewards; RevenueCat/StoreKit for purchased subscription
- Must not: require login, ads, contribution, or payment for core translation or alphabet lessons
- Must not: require a PC, tunnel, or cloud API for translation/STT in the product path
- Must not: put Supabase service keys, RevenueCat secret keys, AdMob secrets, webhook secrets, or admin credentials in the app bundle
- Must not: camera translate; smart glasses / Halo / Multipeer
- Must not: trust the client to create credits, extend ad-free time, change trust, or mark corrections valid
- Must not: use model similarity alone as proof of correctness
- Must not: edit `benchmarks/gold/` references to raise scores, or use gold as contributor known checks
- Must not: forced interstitials, launch ads, ads in Conversation, ads while listening/speaking, or ads over the keyboard

## Not Doing (this release)
- PC hybrid Whisper/IndicTrans2 servers / cloud product MT
- Web/Safari demo as a product surface
- Camera OCR
- Hindi or other Nepal languages as product languages
- Smart glasses / Brilliant Halo
- Swift-only rewrite (Expo is the app shell; native modules OK for inference)
- Android / Google Play ship
- English Learn curriculum, streaks, levels
- Cash value / transfers / withdrawals for contribution credits
- Citizenship detector or App Store country as a citizenship claim
- ATT / IDFA in this beta (contextual / non-personalized ads; declare SDK collection accurately)

## Definition of Done (product coherence + beta readiness)
- Docs and INTENT describe offline core + optional online services clearly
- App keeps Auto + Conversation behavior; Learn alphabet is offline
- No temporary sync secret / reviewer password in the production path
- Gold bench remains a private holdout; contributor known checks are separate
- Feature flags can disable contributions, rewards, network banners, rewarded ads, and paywall without an app update
- Release Definition of Done in `.agent/DONE.md` is fully checked before public submission

## Sensitive areas
- Apple Developer / EAS / App Store Connect credentials and IAP pricing
- Supabase project, Apple provider, service role (Edge Functions only)
- AdMob / RevenueCat keys and webhooks
- Bundled model weights and licenses
- Private gold benchmark answers (do not publish; do not reuse as contributor known checks)
- Contribution agreement, Privacy Policy, Terms, deletion/retention (legal review required before live collection / dataset use)
