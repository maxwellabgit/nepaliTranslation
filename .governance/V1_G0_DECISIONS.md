# V1 Gate 0 — product contract freeze

**Date:** 2026-09-22  
**Audit tip:** `43f9bc6` (merge of F10 / PR #14)  
**Status:** Frozen for implementation. Implementation slices are **G1–G7** in [`plans/active/v1-testflight-finalization.md`](../plans/active/v1-testflight-finalization.md).  
**This file is docs-only.** Runtime code must not claim these gates are Done.

## Executive decision

`main` at `43f9bc6` is **not** a production V1 or external TestFlight release candidate. It is suitable only as a **diagnostic internal TestFlight** build with contribution upload, live ads, and subscription purchase/restore **remotely disabled** until Gates 1–7 produce evidence.

F0–F10 source work remains the foundation. Ship readiness is gated by **G0–G7**.

## Frozen decisions

### D1 — Public review cardinality

**Up to ten** exclusive public-review assignments **per eligible signed-in reviewer per `America/New_York` review day**, closing at **5:00 PM America/New_York**.

- UI copy: **“up to 10 corrections available today”** — never “ten guaranteed.”
- Not a global ten-item daily batch.
- Hidden synthetic quality checks do **not** consume the daily ten.
- Changing this to a global batch requires a new Gate 0 revision before any migration.

### D2 — Corpus eligibility and benchmark retirement

Public review may import only licensed, de-identified, deduplicated training/candidate/source rows marked `public_review_eligible=true`.

**Must exclude:** frozen benchmarks (`benchmarks/gold/` and copies such as `benchmarks/data/gold_review_pack.json`), secondary holdouts, license/provenance holds, PII/sensitive rows, and duplicates.

On successful public-review submission, atomically set:

- `public_review_eligible=false`
- `training_eligible=false`
- `benchmark_eligible=false` (and any `benchmark_role` cleared / blocked)

A benchmark item may enter public review **only** after permanent retirement from every evaluation manifest. Under product rules it **cannot** later return to training.

Exclusions are enforced in **database views and export jobs** (plus CI), not only app filters. See [`.governance/DATA_CLASSIFICATION.md`](./DATA_CLASSIFICATION.md).

### D3 — Sign-in before purchase, restore, or contribution

Supabase Auth + Sign in with Apple is required before:

- Subscription purchase
- Restore Purchases
- Public review / contribution submission
- Contribution rewards

RevenueCat `app_user_id` **must** be the signed-in Supabase UUID before any paywall or restore. Anonymous RevenueCat IDs are not a V1 purchase path.

Core Translate, Camera, History, Settings, and Learn remain usable without sign-in.

### D4 — Raw speech-media contribution (V1 scope)

**Deferred out of V1 shipping disclosures.**

- V1 consented contribution media that may auto-upload: **Camera photos** (when signed-in, 18+, versioned consent, and `contribution_photos_enabled`).
- V1 public review / text correction path: licensed eligible corpus items (Gate 1).
- **Raw microphone recording upload does not ship in V1** legal copy, permission strings, or consent claims until STT emits a durable recording URI and Gate 2 proves capture → upload → retention → withdrawal/deletion.
- Flag `contribution_speech_enabled` remains in the matrix, **defaults off**, and must stay off in production until that proof exists.
- On-device speech-to-text for live translation remains core product and stays local for guests / non-consenting users.

### D5 — Interstitial timing

Automatic interstitial eligibility requires **15 minutes of foreground-active time since the last successful interstitial impression** (not cumulative lifetime foreground time that never resets). Cap remains **three per America/New_York calendar day**. Quota/timer updates only after a **confirmed impression**. Safe idle opportunities after completed activities are required (Gate 3).

### D6 — Ads and TestFlight honesty

- Internal builds / internal TestFlight: **Google test ad units** only.
- Live network ads and revenue require production unit IDs, UMP/consent handling as configured, AdMob app readiness, and crawlable `app-ads.txt`.
- TestFlight impressions are **not** advertising revenue proof.

### D7 — Rollout flag matrix (defaults)

All optional flags remain independently remote-disableable and **default off** until their gate evidence passes:

| Flag | V1 default until gate | Gate |
|------|----------------------|------|
| `contribution_text_enabled` | off | G1 + G2 |
| `contribution_speech_enabled` | off — deferred claim | G2 (future) |
| `contribution_photos_enabled` | off | G2 |
| `network_ads_enabled` | off | G3 |
| `rewarded_ads_enabled` | off | G3 |
| `automatic_interstitial_enabled` | off | G3 + release go/no-go |
| `paywall_enabled` | off | G3 |
| `telemetry_enabled` | off | G5 |
| `deletion_processing_enabled` | off | G2 + G5 |

Internal diagnostic builds keep contribution, live ads, and paywall **off**.

## Exit evidence (Gate 0)

- [x] This decision file
- [x] [`.governance/DATA_CLASSIFICATION.md`](./DATA_CLASSIFICATION.md)
- [x] INTENT + AGENTS + DONE + ExecPlan + CERTIFICATION + RELEASE_RUNBOOK product-freeze text aligned
- [x] No runtime code in the Gate 0 PR

## Supersedes

Conflicting F0–F10 product-boundary text that asserted cumulative interstitial timers, guest purchase/restore, “ten guaranteed” review items, speech-media auto-upload as a shipping V1 promise, or that F10 merge equals external TestFlight readiness.
