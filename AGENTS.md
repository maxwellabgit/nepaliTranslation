# NepTranslate — agent operating system

Offline-first iOS / iPadOS English ↔ Nepali translator (`mobile/`). Intent lives in [`.governance/INTENT.md`](.governance/INTENT.md). Architecture lives in [`training/ARCHITECTURE.md`](training/ARCHITECTURE.md). Gold eval lives in [`benchmarks/gold/`](benchmarks/gold/). **Ship program (active):** final contract reconciliation gates **C0–C15** in [`plans/active/v1-final-contract-reconciliation.md`](plans/active/v1-final-contract-reconciliation.md). Progress: [`.agent/V1_FINAL_CONTRACT_STATE.md`](.agent/V1_FINAL_CONTRACT_STATE.md). Contract table: [`.governance/V1_G0_DECISIONS.md`](.governance/V1_G0_DECISIONS.md). Prior F0–F10 ([`plans/active/beta-release.md`](plans/active/beta-release.md)), G0–G7 ([`plans/active/v1-testflight-finalization.md`](plans/active/v1-testflight-finalization.md)), and R0–R9 ([`plans/active/v1-testflight-runbook.md`](plans/active/v1-testflight-runbook.md)) are historical. The 2026-09-22 audit remains at [`docs/NepTranslate_V1_Finalization_and_TestFlight_Runbook_71c85df.md`](docs/NepTranslate_V1_Finalization_and_TestFlight_Runbook_71c85df.md).

A fresh agent must be able to enter this repo and know the product, the current lane, remaining work, and how to prove Done. Chat is disposable. These files are not.

## Read before you touch code

1. This file
2. `.governance/INTENT.md` and `.governance/V1_G0_DECISIONS.md`
3. `.agent/LOOP.md` and `.agent/DONE.md`
4. The **one** active plan for your line of effort under `plans/active/`

Do not mix lanes in one run or one PR.

## Lines of effort (rank order)

### Core quality lanes

Ranked by likelihood that an autonomous agent produces a real, checkable improvement in **this** repo. Each line is a separate agent, a separate ExecPlan, and a separate PR.

| Rank | Lane | Why it works here | Launch |
|------|------|-------------------|--------|
| **1** | Eval integrity | Gold is already the ship gate. Schema, leakage, register purity, and freeze checks are file-based and numeric. If gold is dirty, every accuracy claim is false. | `/eval-steward` |
| **2** | UI bug hunt | The product is Expo screens plus overlays. Most bugs are in source. `npm run verify:translate` is the cheap gate. Device-only bugs are listed, not faked. | `/ui-hunter` |
| **3** | Translation accuracy (decode path) | Phrase overlay, romanize, mashup refusal, and lexicon already have scripts. Improve JS/TS MT **without** editing gold answers. Gold scores are the gate. | `/mt-accuracy` |
| **4** | App runtime / efficiency | Warm-up, cancel, STT stop, pass-the-phone, fallbacks are in-repo. Real UX wins; slightly more judgment than 1–3. | `/app-runtime` |
| **5** | Model / on-device ship | Fine-tune, ONNX export, TestFlight weights. Industry-standard, but needs GPU/artifacts a cloud box often lacks. Honest blockers beat fake training. | `/model-ship` |

Do **not** start lane 5 until lane 1 is clean. Do **not** claim translation quality from UI-only diffs.

### Production V1 final contract (dependency order)

Full-business V1 readiness uses **one** living ExecPlan: `plans/active/v1-final-contract-reconciliation.md` (gates **C0–C15**). Execute **exactly one** coherent gate per commit on `cursor/v1-final-contract-reconciliation-5907`. Do not combine adjacent gates. Owner explicitly authorized fast-forward publication of this workstream to `main` on 2026-10-02; never force-push. The R0–R9 table below is historical context for the selected base; it is not the active ship program.

Historical remediation record (do not reopen as the ship program):

| Order | Slice / lane id | Goal | Branch pattern |
|------:|-----------------|------|----------------|
| **R0** | `v1-r0-release-baseline` | Restore honest release baseline: fix js-verify + playwright, capture supabase root cause, doc rewrites, camera copy, version 1.7.0, `testflight` EAS profile with test ads, build-provenance surface | `cursor/v1-r0-release-baseline-*` |
| **R1** | `v1-r1-review-ledger-rotation` | Forward-only migration: reward ledger idempotency on `(user_id, source_type, source_id)`, 5 PM NY rotation ownership, DST, `p_as_of`, exactly-once close/grant, empty/under-10 pool behavior | `cursor/v1-r1-review-ledger-rotation-*` |
| **R2** | `v1-r2-review-corpus-import` | Explicit corpus registry, importer with reject manifest, deduped content hashes, reviewed-item retirement, training/eval exclusion enforcement | `cursor/v1-r2-review-corpus-import-*` |
| **R3** | `v1-r3-review-product-ui` | Mobile Review workflow (Today's 10, confirm/edit/skip/report) + admin adjudication console + server-enforced eligibility | `cursor/v1-r3-review-product-ui-*` |
| **R4** | `v1-r4-consent-media-deletion` | Consent write authorization from `auth.uid()`, withdrawal, 30-day linked-data deletion with proof, real speech + photo capture | `cursor/v1-r4-consent-media-deletion-*` |
| **R5** | `v1-r5-monetization-device-proof` | Interstitial safe opportunities, foreground timer since last impression, offline path, rewarded SSV, RevenueCat sandbox matrix | `cursor/v1-r5-monetization-device-proof-*` |
| **R6** | `v1-r6-model-ship` | Neural EN→NE quality lift + new private uncontaminated holdout, without lowering frozen thresholds | `cursor/v1-r6-model-ship-*` |
| **R7** | `v1-r7-ui-testing-ground` | Mobile / iPad UI polish and Windows testing-ground scenario coverage | `cursor/v1-r7-ui-testing-ground-*` |
| **R8** | `v1-r8-production-ops` | Deploy migrations, Edge functions, cron, backups, legal URLs, alerts on staging + rehearsed rollback | `cursor/v1-r8-production-ops-*` |
| **R9** | `release/1.7.0-rc*` | Produce and test the production release candidate; device matrix; external cohort ≥ seven stable NY rotations | `release/1.7.0-rc*` |

**Dependency rule:** core translation must not depend on Supabase, AdMob, RevenueCat, or admin. Optional services fail soft.

**Do not mix** a core quality lane (1–5) and a V1 contract gate in the same PR.

Prior F0–F10, G0–G7, and R0–R9 plans remain source history. Do not reopen them as the ship program. Conflicting product text yields to INTENT, the decision table in `V1_G0_DECISIONS.md`, and `plans/active/v1-final-contract-reconciliation.md`.

Not autonomous (human-gated, still valid): TestFlight on physical iPhone/iPad; overnight GPU FT on the founder machine; Apple/Supabase/AdMob/RevenueCat console setup; legal copy; bilingual Nepali content sign-off; live interstitial enablement; hosted cron provisioning. Record those as blockers, do not invent results.

## Hard rules

- Scope: EN↔NE only, Expo iOS/iPadOS, on-device STT+MT and on-device camera OCR for the product path, no PC/cloud inference for core translate or OCR. Temporary Camera files are deleted after retake, exit, or successful processing. Do not request photo-library access unless importing existing images is added later.
- One model family (IndicTrans2 dist-200M), not four register models. Informal = **तिमी**, not तँ.
- Never train on `benchmarks/gold/`. Never edit gold references to raise a score.
- **Never** build contributor known-check sets from `benchmarks/gold/`, training holdouts, or private evaluation answers. Known checks are separately curated synthetic backend/admin seed data only.
- Public-review eligibility is deny-by-default. Training and benchmark rows need resolved provenance, license, and public-display rights. Collected rows need a certified anonymization record. Unresolved rights are `admin_only`. Publicly exposed source and target hashes are excluded from train and eval exports. Do not edit gold references to feed the review pool.
- Expo SDK **57** docs only for this release: https://docs.expo.dev/versions/v57.0.0/
- First launch is bilingual Terms + Privacy acceptance and a language choice. It does not require an account or an 18+ attestation. The 18+ attestation and specific opt-in are the contribution gate; a private authenticated guest identity supplies authorization.
- Owner amendment 2026-10-02: no account, registration, login/logout, Apple/Google sign-in, linking or recovery UI. Create and persist an authenticated Supabase guest identity behind the scenes for credits, contributions, purchases/restore and shared-data deletion. Preserve existing installed subjects privately; never adopt another subject’s queued data. Accepted recovery tradeoff: reinstall/new phone or terminal credential loss can lose remote guest balance/data access.
- Authenticated sessions expire after **30 days** of inactivity. Expiry must not disable guest core surfaces.
- Unauthenticated or consent-declined translation history, microphone audio, transcripts, clipboard and photos stay local. Authenticated guest identity alone never authorizes collection. After current contribution consent, 18+, a valid session, and the default-off speech toggle, eligible speech recordings may upload when the remote flag is on. Camera photos are temporary on-device OCR input and are not a contribution upload. Never upload without a valid private guest session, current specific contribution opt-in, 18+, matching flag and original ownership. Ownerless clips never attach to a later identity. Terms/Privacy acceptance is separate and never authorizes contribution upload.
- Never put service/secret keys in the app bundle or admin browser code.
- Monetization boundary: **USD 2.99/month** (US), **CAD 2.99/month** (Canada), and **USD 1.49/month** (Nepal), shown as StoreKit/RevenueCat's localized price; banners only idle Translate + idle Learn; automatic interstitial after **10 minutes** of foreground-active time, **no daily cap**, only at Translate Send, Camera capture, and Learn activity-complete safe points; the main-branch clock reset stands, and a local welcome or daily ad-free grant still suppresses that interstitial; rewarded video = **2 credits / 20 ad-free minutes**; **1 credit = 10 minutes**; the first installation open grants **10** credits and each later New York date grants **5**, stacking up to a **12-hour** hard cap; bundled meanings are local samples, and passing **90 percent** records a count with no review reward; the Home gauge's full mark is **50 credits** of remaining time and is not printed or an earning cap; when the inner bar is full, that fill turns red and the pill and clock stay the same size and color; no credit clawback; no automatic training from contributions; RevenueCat identity = Supabase UUID; TestFlight ads are Google test units and produce no revenue.
- Compiling is not Done. See `.agent/DONE.md`.
- For V1 functional finalization, follow the 2026-10-01 living INTENT/decision contract and revised C0–C15 plan. Today's 10 category coins are completion badges, not review-earned ad-free credits; capture actual responses as well as progress. Typed-result and speech-result feedback are contribution methods, subject to existing signed-in/current-consent/18+/flag rules.
- Before any additional UI redesign, capture the current installed app on a physical iPhone 17 Pro with build/state provenance. Use one separate image-generation agent per screenshot-based proposal, return absolute before/after file paths, and implement only owner-approved designs. Browser/simulator screenshots cannot stand in for this native baseline.
- After implementation, run `/independent-reviewer` in a fresh context. Findings become work items.
- Advance to the next V1 gate only with green gates and no material independent-review findings.

## Persistence

| File | Job |
|------|-----|
| `.governance/INTENT.md` | What the product is |
| `.governance/V1_G0_DECISIONS.md` | Living decision table; 2026-09-22 freeze kept as history |
| `.governance/DATA_CLASSIFICATION.md` | Deny-by-default review/train/benchmark eligibility |
| `training/ARCHITECTURE.md` | How MT is supposed to work |
| `AGENTS.md` | How an AI behaves here |
| `.agent/PLANS.md` | ExecPlan contract |
| `.agent/V1_FINAL_CONTRACT_STATE.md` | C0–C15 progress (status, SHA, next action) |
| `plans/active/v1-final-contract-reconciliation.md` | Active V1 ship contract (C0–C15) |
| `plans/active/v1-testflight-runbook.md` | Historical R0–R9 log |
| `plans/active/v1-testflight-finalization.md` | Historical G0–G7 log |
| `plans/active/beta-release.md` | Historical F0–F10 foundation log |
| `docs/NepTranslate_V1_Finalization_and_TestFlight_Runbook_71c85df.md` | 2026-09-22 external audit that opened R0–R9 |
| `benchmarks/gold/` + `mobile` verify scripts | How you prove translation quality |

When a lesson should stick, add a short rule here or in `.cursor/rules/` — do not rely on chat memory.

## Cursor Cloud specific instructions

Linux Cloud Agents use the Expo web export inside `testing-ground`. iOS Simulator, TestFlight, on-device ONNX, and live microphone or camera capture are not available on this image.

- Node.js 22 is already installed. From the repo root, `npm ci --prefix mobile`, `npm ci --prefix admin`, and `npm ci --prefix testing-ground` install the three apps. Then `npm run export:lexicon --prefix mobile` (the lexicon JSON is gitignored) and `env CI=1 EXPO_NO_TELEMETRY=1 npm --prefix mobile exec -- expo export --platform web`.
- `npm run prepare:hosted --prefix testing-ground` copies `mobile/dist` into `testing-ground/public/hosted-app`. Serve it with `npm --prefix testing-ground exec -- vite --host 127.0.0.1 --port 5173 --strictPort`.
- Admin uses port **5174** so it does not collide with the testing ground: `npm --prefix admin exec -- vite --host 127.0.0.1 --port 5174 --strictPort`. Without `admin/.env`, the page reports missing `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`. This image has no Docker, so local Supabase is not started.
- Playwright Chromium: `npm --prefix testing-ground exec -- playwright install chromium`. A representative product check is `cd testing-ground && CI=true npx playwright test scenarios/product-scenarios.spec.ts -g "02 typed" --project=desktop` (recorded Hello → नमस्ते).
- Cheap mobile checks: `npm run verify:translate --prefix mobile` and `npm run typecheck --prefix mobile`. Admin: `npm test --prefix admin` and `npm run typecheck --prefix admin`.
Owner amendment 2026-10-02: Today's 10 requires all actual answers (skip is not completion); written reports can finish questions but never advance the confirm/edit-only allotment metric. Preserve original/revised responses independently and private-identity-bound; completed batches remain reopenable with per-category Extra 10. Thanks-only timer ends at 5 PM America/New_York (DST-aware). Displayed-ad skip grants one credit/one coin; full rewarded completion two credits/two coins, with exact owner SSV receipt required for permanent native stacking. Never persist provisional balances via skip/daily grants. Engineering browser-local model testing is separate from the native product path; Reset is one-shot and clears timers to zero.

Guest privacy amendment 2026-10-02: specific model-improvement disclosure lists source/result, ratings, corrections, review answers, metadata and optional audio/transcripts; Camera photos stay local. Speech defaults off, including renewed consent. Withdrawal/deleting shared data stops local sharing immediately even offline, persists owner-bound intent/deadline and retries; uploaded data purge ≤30 days preserves credits/private identity/core. Do not fabricate deadlines or completion. Fresh consent cannot cancel an open deletion. Verified terminal credential loss may create a fresh guest after isolating prior consent/queues; network failure never rotates UUID. Hosted anonymous-auth enablement, endpoint/migrations and cron need actual proof. Historical full linked-identity deletion remains backend history, not product UI.

Hosted follow-up 2026-10-03: .agent/GUEST_HOSTED_PROOF_2026-10-03.md records actual guest Auth/capture/retrieval/scheduled deletion. The worker must never invoke retired reward close/rotation/lookahead; a thirty-day shared-data deletion deadline is an upper bound, not a wait-before-first-attempt. The owner subsequently approved disclosures and a controlled synthetic collection test; that test completed and restored collection flags off. Internal diagnostic TestFlight delivery was explicitly resumed separately. Neither Supabase approval nor diagnostic delivery authorizes public release or ongoing collection.

Console source-transfer rule: explicitly select all editor content before replacing SQL/function source, compare the prepared text before deploying, then reload and read back the persisted source. A successful deploy toast alone is not source verification.
