# App Store privacy labels (match runtime SDKs)

Worksheet for App Store Connect **App Privacy** answers. Update when SDKs or
data practices change. Product boundary: [`.governance/INTENT.md`](../.governance/INTENT.md).

**F8 status:** Source-aligned answers below. Live Connect form + legal review
remain human-gated. Do not invent device ATT prompts — this release does **not**
use ATT / IDFA.

## Data collection summary (declared runtime)

| Data type | Collected? | Linked to user? | Used for tracking? | Purpose | Source / SDK |
|-----------|------------|-----------------|--------------------|---------|--------------|
| Crash / diagnostics (no raw content) | Optional, flag-gated | No (anonymous) | No | App functionality / analytics | First-party telemetry module (`telemetry_enabled`, default **off**). Scrubber bans text/audio/OCR/photos. |
| Product interaction (screen / feature codes) | Optional, flag-gated | No | No | Analytics | Same telemetry module |
| Performance data (durations, reason codes) | Optional, flag-gated | No | No | App functionality | Same telemetry module |
| Contact info (email) | No in-app collection | — | — | — | Support mailbox is out-of-band (`support@neptranslate.app`) |
| Name / phone / physical address | No | — | — | — | — |
| Health / sensitive | No | — | — | — | — |
| Photos / videos | **Yes (optional)** | Yes (account) | No | App functionality (consented contribution) | Camera path local by default; upload only after 18+ versioned consent + flags. Not sent to analytics. |
| Audio data | **Yes (optional)** | Yes (account) | No | App functionality (consented contribution) | Speech contribution pipeline when gated; not analytics. |
| Product content (translations / transcripts) | **Yes (optional)** | Yes (account) | No | App functionality (contribution) | First-party Supabase contribution path only — **never** third-party analytics. |
| User ID | Yes when signed in | Yes | No | App functionality / account | Sign in with Apple → Supabase Auth |
| Device ID | Possibly via ads SDK | See AdMob | No ATT tracking this release | Advertising (contextual / non-personalized default) | `react-native-google-mobile-ads` when network ads flags on |
| Purchase history | Yes when subscribed | Yes | No | App functionality / purchases | RevenueCat (`react-native-purchases`) + StoreKit; public API key only in app |
| Advertising data | Yes when ads enabled | Per AdMob/UMP | No IDFA claim | Advertising | AdMob + UMP; house ads offline |

## Explicit non-claims (this release)

- **No ATT / IDFA** — do not declare “tracking” via IDFA; contextual / non-personalized ads are the V1 default.
- **No third-party analytics of raw translations, transcripts, OCR, audio, or photos.**
- **Telemetry** must remain off until legal + privacy review and `telemetry_enabled` remote flag.
- Core Translate / Camera / Learn / History / Settings work without login, ads, paywall, or telemetry.

## SDKs present in the iOS product path

| SDK / service | Role | Privacy notes |
|---------------|------|---------------|
| Expo / React Native | App shell | Standard OS permissions: mic, speech, camera purpose strings |
| ONNX Runtime + IT2 weights | On-device MT | No network for core translate |
| `neptranslate-ocr` / ML Kit | On-device OCR | Temporary captures deleted after retake/exit/processed |
| `expo-speech-recognition` | On-device STT preference | Fail closed when on-device locales missing |
| Supabase JS | Auth, config, contributions | Anon key only in app; service role never in bundle |
| `react-native-google-mobile-ads` | Banners / rewarded / interstitial | Flags default off; UMP; no custom interstitial skip |
| `react-native-purchases` (RevenueCat) | Optional ad-free subscription. Target price USD 2.99/month (US) and NPR 199/month (Nepal), displayed from StoreKit. Not yet confirmed in App Store Connect | Public Apple API key only |
| First-party telemetry (F8) | Crash/perf/usage schema | Scrubbed; flag default off; soft-fail |

## Connect form checklist (human)

- [ ] Privacy Policy URL live and matches this worksheet
- [ ] Terms / support URLs live
- [ ] Answers above entered in App Store Connect for the exact freeze build
- [ ] No ATT prompt added without updating this doc + INTENT
- [ ] `app-ads.txt` crawlable if AdMob inventory is live
