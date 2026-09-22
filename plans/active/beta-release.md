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
- [x] **F2** — Bilingual UI, dark mode, accessibility, iPhone + iPad layouts — independent review PASS (`a718794`)
- [x] **F3** — Consented speech/photo ingestion and private storage — independent review PASS (`efaae53`)
- [x] **F4** — 5 PM America/New_York reward close, alerts, 30-day deletion jobs — independent review PASS (`5764410`)
- [x] **F5** — Banners, interstitials, rewarded ads, full ad-policy tests — independent review PASS (`657783b`)
- [x] **F6** — RevenueCat / StoreKit $0.99 subscription — independent review PASS; merged PR #9
- [ ] **F7** — Protected operational admin console
- [ ] **F8** — Telemetry, legal/store surfaces, security, dependency triage
- [ ] **F9** — Exact model certification + extended Windows automation
- [ ] **F10** — Device matrix, TestFlight, App Store release gates

## Decision log

- 2026-09-21: **V1 final boundary supersedes beta monetization/privacy text.** Full-business V1: $0.99/month ad-free; banners only idle Translate + Learn landing; automatic interstitial after 15 foreground-active minutes, max 3 per America/New_York day, SDK-owned dismiss, remotely disableable (off until device + external-beta gates); rewarded video = 15 ad-free minutes; 1 credit = 5 minutes; >20 original words = 2 credits; reward close 5:00 PM America/New_York; pending at close earns once; late rejection → alert only, no clawback; contribution requires Sign in with Apple + 18+ + versioned consent; post-consent speech/photo auto-upload; indefinite retention until withdrawal/deletion; 30-day purge; telemetry OK without raw content; bilingual UI; genuine iPhone+iPad. Feature flags independent; defaults off until gates pass.
- 2026-09-21: Camera remains in product; Translate absorbs Conversation; tabs Translate / Camera / Learn. Guests keep temporary on-device captures only; consented adults may upload eligible media when flags allow.
- 2026-09-21: Foundation tip `9b17ac9` is **not** a complete monetized production V1 until F0–F10 + go/no-go.
- 2026-09-21: F1 pins IT2 downloads to immutable HF revisions + SHA-256. Tracked manifest: `mobile/src/mt/onnx/it2-release-manifest.json` (weights under `assets/models/` stay gitignored). EAS fetch fails on mismatch.
- 2026-09-21: F3 consent version `2026-09-21.media`. Text path uses `contribution_text_enabled`; speech/photo use dedicated flags (defaults off). Speech auto-upload gate+outbox land; STT still does not emit a durable recording URI.

## Progress

**Current: F7 — protected operational admin console (independent review PASS @ `f3fe6bc`)**

| Area | Change |
|------|--------|
| Migration | `20260922010000_f7_admin_ops.sql` — `service_assert_admin` + dashboard/review/alerts/deletions/flags/dataset/media-preview RPCs |
| API | `admin-api` router: JWT → assert admin → service RPCs; media sign + audit; CORS soft local Vite + `ADMIN_ORIGIN` |
| Admin SPA | `admin/` Vite+React — dashboard, review (+ signed preview), alerts, deletions, flags, dataset staging; anon+JWT + `apikey` |
| Tests | Deno `admin_api_test` (401/403/ok/CORS); pgTAP `15_f7_admin_ops`; Vitest API 403 + apikey; CI `backend-gate` admin job |
| Commands | `cd admin && npm test` (+ typecheck); `deno test … supabase/functions/tests` (52); pgTAP via CI when Docker unavailable locally |
| IR | PASS after apikey + CORS soft-allow fix ([independent-reviewer](36d7ebaa-692c-4fa8-8684-195ad0fbdfdf)) |

**Previous: F6** — PASS; merged PR #9 (`0fc3b1f`).

## Remaining work

1. Human merge of F7 when ready → start F8.

## Blockers (concrete; cannot be solved from this repo)

- Local Docker Desktop engine not running → cannot `supabase db reset` / `test db` on this agent host (CI must prove)
- Playwright signed-in admin triage/export/deletion not automated in F7 (needs live allowlisted session)
- Production `private.admin_users` allowlist insert/revoke remains human-gated
- On-device STT (`expo-speech-recognition`) does not produce a durable audio file URI → speech auto-upload path is gated + outbox-ready but not wired to live mic capture
- Physical iPhone / iPad proof, CocoaPods/ML Kit/AdMob/RevenueCat together
- App Store Connect $0.99 subscription product + RevenueCat dashboard + webhook secret (human)
- App Store Connect $0.99 subscription product + legal Privacy/Terms URLs (legal review before live media collection)
- Bilingual human sign-off; external TestFlight cohort
- Automatic interstitial enablement is a deliberate release go/no-go, not implied by code landing
- StoreKit sandbox / TestFlight purchase-restore-expire matrix is human-gated
- Full Dynamic Type + VoiceOver pass (F10 device matrix)
