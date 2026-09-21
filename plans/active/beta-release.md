# beta-release: Production V1 finalization (F0–F10)

## Goal
Ship a complete, monetized English↔Nepali iOS/iPadOS V1 — offline core intact; optional ads, $0.99/month subscription, consented speech/photo contributions, rewards, admin, and TestFlight/App Store gates — without breaking guest Translate, Camera, History, Settings, or Learn.

## Context (paths, commands, constraints)

- **Baseline:** `main` at `9b17ac9b72791a3eae3384343e25290684d84bf1` (2026-09-21). Windows/source foundation is proven; product-boundary docs still matched the old beta contract until F0.
- **Source plan:** `NepTranslate_Production_V1_Finalization_Plan_9b17ac9.md` (founder).
- **Branch policy:** exactly one slice per branch/PR: `cursor/v1-fN-short-name`.
- **Product contract:** `.governance/INTENT.md` (offline core + full-business optional services).
- **Operating protocol:** `AGENTS.md`, `.agent/LOOP.md`, `.agent/DONE.md`, this ExecPlan.
- **Protected:** `mobile/src/mt/`, `mobile/src/stt/`, translation verify scripts, Expo SDK 57. No model-family change; no cloud translation for core.
- **Prohibited:** never edit or copy contributor known-check answers from `benchmarks/gold/`. Never auto-train or auto-modify benchmarks from contributions. Never invent device/TestFlight results.
- **Prior program:** beta slices 00–08 / H0–H6 and Windows readiness slices 1–12 are **closed as foundation**. Do not reopen them; implement F0–F10 against INTENT.

### Baseline proof (recorded at `9b17ac9`)

```text
cd mobile && npm run verify:ci
# GitHub: JavaScript verification, secret scan, Supabase — green
cd testing-ground && npm run build
# Playwright product scenarios: 10/12 automated; live mic + live camera+ML Kit device-only
```

Re-run `verify:ci` after `npm ci` when `node_modules` is incomplete. `verify:translate` remains mandatory on every mobile-changing PR.

## Done when (copy the lane checklist from DONE.md)

V1-wide + current-slice checklist in `.agent/DONE.md`. F0 specifically: durable docs only; no runtime code; a fresh session can state monetization, contribution/privacy, flags, current slice, and prohibited files without chat history.

## Milestones

- [x] **F0** — Rewrite durable product contract (docs only) — independent review PASS; merged PR #3
- [x] **F1** — STT privacy, raw logging, model reproducibility, Camera stability — independent review PASS (`05adf43`)
- [x] **F2** — Bilingual UI, dark mode, accessibility, iPhone + iPad layouts — verify:ci green; review pending
- [ ] **F3** — Consented speech/photo ingestion and private storage
- [ ] **F4** — 5 PM America/New_York reward close, alerts, 30-day deletion jobs
- [ ] **F5** — Banners, interstitials, rewarded ads, full ad-policy tests
- [ ] **F6** — RevenueCat / StoreKit $0.99 subscription
- [ ] **F7** — Protected operational admin console
- [ ] **F8** — Telemetry, legal/store surfaces, security, dependency triage
- [ ] **F9** — Exact model certification + extended Windows automation
- [ ] **F10** — Device matrix, TestFlight, App Store release gates

## Decision log

- 2026-09-21: **V1 final boundary supersedes beta monetization/privacy text.** Full-business V1: $0.99/month ad-free; banners only idle Translate + Learn landing; automatic interstitial after 15 foreground-active minutes, max 3 per America/New_York day, SDK-owned dismiss, remotely disableable (off until device + external-beta gates); rewarded video = 15 ad-free minutes; 1 credit = 5 minutes; >20 original words = 2 credits; reward close 5:00 PM America/New_York; pending at close earns once; late rejection → alert only, no clawback; contribution requires Sign in with Apple + 18+ + versioned consent; post-consent speech/photo auto-upload; indefinite retention until withdrawal/deletion; 30-day purge; telemetry OK without raw content; bilingual UI; genuine iPhone+iPad. Feature flags independent; defaults off until gates pass.
- 2026-09-21: Camera remains in product; Translate absorbs Conversation; tabs Translate / Camera / Learn. Guests keep temporary on-device captures only; consented adults may upload eligible media when flags allow.
- 2026-09-21: Foundation tip `9b17ac9` is **not** a complete monetized production V1 until F0–F10 + go/no-go.
- 2026-09-21: F1 pins IT2 downloads to immutable HF revisions + SHA-256. Tracked manifest: `mobile/src/mt/onnx/it2-release-manifest.json` (weights under `assets/models/` stay gitignored). EAS fetch fails on mismatch.

## Progress

**Current: F2 — Bilingual UI, theme, responsive layouts**

| Area | Change |
|------|--------|
| UI lang | Persisted `uiLang` (AsyncStorage prefs); `UiLangProvider` before auth; Settings English/नेपाली chips switch chrome immediately |
| Catalog | Expanded `en`/`ne` for tabs, Translate, Camera, Learn rewards, ads, auth; `t()` param interpolation |
| Screens | AppShell, Translate (+ composer/options/turns), Camera, RewardSummary, HouseAd, RewardedAd, AccountSection, CorrectionSheet, ContributionCard, AlphabetLesson use `t()` + `useTheme()` |
| Theme | `userInterfaceStyle: automatic`; scheme-aware StatusBar; major screens + contribution sheets off static light `colors` |
| Layout | `sizeClass` phone / tablet11 / tablet13; content max-width; Camera capture/result stays portrait-dark |
| a11y | Min 44pt on tabs, Speak/Pass, Camera shutter/retake; labels on primary controls |
| TG | Playwright projects: desktop + iPad 11 (`768×1024`) + iPad 13 (`1024×1366`); touch-target smoke on iPad |
| Tests | `uiLang-test`, `sizeClass-test`, `catalogCoverage-test` (banned EN chrome + CorrectionSheet/ContributionCard), i18n key parity |

**Honesty:** Full Dynamic Type scaling and VoiceOver walkthrough remain device-gated (F10). Contribution age copy is **18+** (INTENT); full consent migration remains F3. CERTIFICATION bilingual UI row is Partial / F2 chrome wired. Provisional grant ms constants remain F4/F5.

**Previous: F1 — privacy / offline-core** — independent review PASS (`05adf43`); merged PR #4.

**Previous: F0 — durable product contract** — merged PR #3 (`a5d9013`).

## Surprises & discoveries

- Repository contract still contradicted founder V1 decisions until F0 (price, age, media upload, interstitial, reward TZ, rewarded minutes).
- Google warns interstitials may be unsuitable for utility apps — keep `automatic_interstitial_enabled` remotely off until deliberate go/no-go.
- Early F2 scaffold had catalog keys + Settings selector but AppShell/Translate/Camera still hardcoded EN until this repair.
- ContributionCard still said “13 or older” after F2 chrome wire; repaired to catalogued 18+.
- First Playwright iPad attempt failed (Chromium missing in sandbox); `npx playwright install chromium` then re-run passed.

## Commands that actually ran (paste)

```text
# F2 IR repair — contribution sheets + 18+ + catalogCoverage + CERTIFICATION
cd mobile
npm run verify:ci
# exit 0 (~46s): lint, typecheck, unit 56 suites / 240 tests (incl. catalogCoverage),
# integration 2 suites / 19 tests, verify:translate OK, expo-doctor,
# coverage ratchet OK, export:web

cd testing-ground
npx playwright install chromium   # first attempt: browser missing in sandbox cache
npx playwright test --project=ipad-11 --grep "smoke|tabs|translate"
# 1 passed (3.5s): 03 tab switch Translate / Camera / Learn [ipad-11]
```

## Remaining work

1. Independent review of F2 (parent runs independent-reviewer) after contribution-sheet catalog+theme + 18+ repair.
2. Do **not** start F3 until F2 is merged.

## Blockers (concrete; cannot be solved from this repo)

- Physical iPhone / iPad proof, CocoaPods/ML Kit/AdMob/RevenueCat together
- App Store Connect $0.99 subscription product + legal Privacy/Terms URLs
- Bilingual human sign-off; external TestFlight cohort
- Automatic interstitial enablement is a deliberate release go/no-go, not implied by code landing
- Full Dynamic Type + VoiceOver pass (F10 device matrix)
