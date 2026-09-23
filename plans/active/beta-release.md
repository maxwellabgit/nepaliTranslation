# beta-release: Production V1 foundation (F0–F10) — CLOSED AS SHIP PROGRAM

> **Superseded for ship readiness.** F0–F10 source merged through `43f9bc6`. Later programs G0–G7 and R0–R9 are also historical. The living contract is [`v1-final-contract-reconciliation.md`](./v1-final-contract-reconciliation.md) (**C0–C15**). Do not open new F-slice PRs. Do not rewrite this log.

## Goal
(Historical.) Land monetized English↔Nepali iOS/iPadOS V1 **source** foundation — offline core intact; optional ads, $0.99/month subscription, consented media, rewards, admin, and release docs — without breaking guest Translate, Camera, History, Settings, or Learn.

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
- [x] **F2** — Bilingual UI, dark mode, accessibility, iPhone + iPad layouts — independent review PASS (`a718794`)
- [x] **F3** — Consented speech/photo ingestion and private storage — independent review PASS (`efaae53`)
- [x] **F4** — 5 PM America/New_York reward close, alerts, 30-day deletion jobs — independent review PASS (`5764410`)
- [x] **F5** — Banners, interstitials, rewarded ads, full ad-policy tests — independent review PASS (`657783b`)
- [x] **F6** — RevenueCat / StoreKit $0.99 subscription — independent review PASS; merged PR #9
- [x] **F7** — Protected operational admin console — independent review PASS; merged PR #10
- [x] **F8** — Telemetry, legal/store surfaces, security, dependency triage — independent review PASS; merged PR #11
- [x] **F9** — Exact model certification + extended Windows automation — independent review PASS (`52aeabb`); merged PR #12
- [x] **F10** — Device matrix, TestFlight, App Store release gates (docs + honest open boxes) — merged PR #14 (`43f9bc6`)

## Decision log

- 2026-09-22: **F10 merged; ship program moves to G0–G7.** Audit found ads SDK mismatch, RevenueCat orphan risk, missing review pool, consent/deletion gaps, soft model cert, unverified scheduler. See `.governance/V1_G0_DECISIONS.md`.

- 2026-09-21: **V1 final boundary supersedes beta monetization/privacy text.** Full-business V1: $0.99/month ad-free; banners only idle Translate + Learn landing; automatic interstitial after 15 foreground-active minutes, max 3 per America/New_York day, SDK-owned dismiss, remotely disableable (off until device + external-beta gates); rewarded video = 15 ad-free minutes; 1 credit = 5 minutes; >20 original words = 2 credits; reward close 5:00 PM America/New_York; pending at close earns once; late rejection → alert only, no clawback; contribution requires Sign in with Apple + 18+ + versioned consent; post-consent speech/photo auto-upload; indefinite retention until withdrawal/deletion; 30-day purge; telemetry OK without raw content; bilingual UI; genuine iPhone+iPad. Feature flags independent; defaults off until gates pass.
- 2026-09-21: Camera remains in product; Translate absorbs Conversation; tabs Translate / Camera / Learn. Guests keep temporary on-device captures only; consented adults may upload eligible media when flags allow.
- 2026-09-21: Foundation tip `9b17ac9` is **not** a complete monetized production V1 until F0–F10 + go/no-go.
- 2026-09-21: F1 pins IT2 downloads to immutable HF revisions + SHA-256. Tracked manifest: `mobile/src/mt/onnx/it2-release-manifest.json` (weights under `assets/models/` stay gitignored). EAS fetch fails on mismatch.
- 2026-09-21: F3 consent version `2026-09-21.media`. Text path uses `contribution_text_enabled`; speech/photo use dedicated flags (defaults off). Speech auto-upload gate+outbox land; STT still does not emit a durable recording URI.
- 2026-09-22: F8 telemetry is first-party scrubbed schema only (no new analytics SDK). Live Privacy/Terms/support/`app-ads.txt` remain hosting blockers — Settings shows honest “not live yet” when `EXPO_PUBLIC_*` URLs empty.
- 2026-09-22: F9 pre-declares four-class gold ship floors in `docs/MODEL_CERT.md` + `benchmarks/ship_thresholds.json`. `certify_ship_artifacts.py` validates schema/pins always; soft BLOCKER when ONNX weights absent. Playwright F9 surfaces + browser cache in CI. Maestro stubs expanded with honest native blockers.

## Progress

**Closed as ship program.** Tip `43f9bc6` = F10 merged. Continue in `v1-testflight-finalization.md`.

**Last F10 work (merged):**

| Area | Change |
|------|--------|
| Device proof | `docs/DEVICE_PROOF.md` — build-under-test table, same-build matrix rule, unchecked human boxes |
| Release runbook | `docs/RELEASE_RUNBOOK.md` — interstitial go/no-go, 7-day log, freeze worksheet, rollback rehearsal, public go/no-go |
| Honesty | No invented EAS/TestFlight/device results; all matrix/stability boxes left unchecked |

## Commands run (F10)

```text
# Docs-only slice. No runtime code.
# Verify no matrix boxes invented as checked in DEVICE_PROOF / RELEASE_RUNBOOK.
```

## Remaining work

1. ~~Independent review PASS → merge F10~~ Done (PR #14).
2. Human device / TestFlight / go/no-go work continues under **G4–G7** (not new F-slices).
3. Do not treat this ExecPlan as the active ship lane.

## Progress (prior)

**F9 — model certification + Windows automation** — independent review PASS (`52aeabb`); PR #12 pending merge onto main when approval UI allows.
## Blockers (concrete; cannot be solved from this repo)

- Exact four-class ONNX gold eval vs ship floors — **weights missing** on this agent host (`mobile/assets/models/it2_*`)
- Live Privacy / Terms / support / deletion HTTPS pages and crawlable `app-ads.txt` (hosting + legal)
- App Store Connect privacy form entry (worksheet only in repo)
- Local Docker Desktop engine not running → cannot `supabase db reset` / `test db` on this agent host (CI must prove)
- On-device STT (`expo-speech-recognition`) does not produce a durable audio file URI → speech auto-upload path is gated + outbox-ready but not wired to live mic capture
- Physical iPhone / iPad proof, CocoaPods/ML Kit/AdMob/RevenueCat together
- App Store Connect $0.99 subscription product + RevenueCat dashboard + webhook secret (human)
- Bilingual human sign-off; external TestFlight cohort
- Automatic interstitial enablement is a deliberate release go/no-go, not implied by code landing
- StoreKit sandbox / TestFlight purchase-restore-expire matrix is human-gated
- Full Dynamic Type + VoiceOver pass (F10 device matrix)
- Playwright signed-in admin triage (F7 leftover human gate)
- Production `private.admin_users` allowlist insert/revoke remains human-gated
- Expo-transitive npm advisories accepted per `docs/DEPENDENCY_TRIAGE.md` until SDK-compatible upstream
- Maestro native flows require installed IPA + human Appearance/Sign-in/AdMob setup
