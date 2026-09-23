# V1 product decisions

**Living contract date:** 2026-09-23
**Selected base:** `034f1cc66b991bf5c7ba5062bfebee7ec87f1d42` (`origin/cursor/v1-r6-r9-blockers-5907`), a verified descendant of `origin/main` `71c85df5a4a7ba238c3496ed243ea0b25b027d91`
**Authority:** [`plans/active/v1-final-contract-reconciliation.md`](../plans/active/v1-final-contract-reconciliation.md) and [`.governance/INTENT.md`](./INTENT.md)
**Status:** The decision table below is the living contract. The 2026-09-22 Gate 0 freeze that follows is **historical evidence**. Do not implement the historical numbers when they conflict.

## Decision table (final contract)

| Topic | Required value | Supersedes |
|-------|----------------|------------|
| Review credits | **2** credits when snapshotted original source words are 0–20; **4** credits when 21 or more | Top-half / top-50%-longest / 1-credit and 2-credit percentile tiers |
| Credit duration | **15** ad-free minutes per credit | Any 5-minute credit |
| Rewarded ad | **2** credits (30 minutes) after one server-verified confirmation | 1 credit / 15 minutes per rewarded view |
| Review lookahead | Minimum **14** New York days before public review is enabled; target **28**; every 14 days append, never reshuffle | Same-day random 10 with no private horizon |
| Session inactivity | **30 days**, rolling, on refresh; JWT stays short | Indefinite Supabase auto-refresh |
| Interstitial cap | **None.** Eligibility after 15 minutes of foreground-active time since the last confirmed impression; display only at Translate Send, Camera capture, and Learn idle-return safe points | Three per America/New_York day |
| Subscription | **USD 2.99/month** (United States storefront); **NPR 199/month** (Nepal storefront). Display StoreKit/RevenueCat's localized price. Never infer storefront from language, IP, GPS, or device locale | US $0.99/month as the product price |

Also binding, from the same plan:

- Public correction UI is one route: **Today's 10**, subtitle **Review translations**.
- Primary tabs are Translate, Camera, and Learn. Account lives in Settings.
- First launch is bilingual legal acceptance plus language choice. 18+ is the signed-in contribution gate.
- Exactly two sharing toggles, both default off: speech recordings and Camera photos.
- Automated V1 review validation logs a deterministic local cosine score and returns **PASS**. A timely human unsatisfactory mark prevents reward. Late rejection does not claw back credits.
- Public-review eligibility is deny-by-default. Unresolved rights are `admin_only`.
- Public exposure excludes source and target hashes from train and eval export.
- TestFlight uses Google test ad units and produces no revenue.

## Feature flags at the selected base

Risky and network features default **off** until hosted proof exists. Client defaults are `mobile/src/app/featureFlags.ts` `DEFAULT_FEATURE_FLAGS`. Database defaults are the `app_config` column defaults. `supabase/seed.sql` sets `contribution_text_enabled` and `contributions_enabled` true for local RPC tests only; that seed is not a production default.

| Flag | Client default | Database default |
|------|----------------|------------------|
| `contribution_text_enabled` | off | off |
| `contribution_speech_enabled` | off | off |
| `contribution_photos_enabled` | off | off |
| `rewards_enabled` | off | off |
| `network_ads_enabled` | off | off |
| `rewarded_ads_enabled` | off | off |
| `automatic_interstitial_enabled` | off | off |
| `paywall_enabled` | off | off |
| `telemetry_enabled` | off | off |
| `deletion_processing_enabled` | server-only | off |
| `learn_enabled` | bundled false; runtime forced on | core product |

No public-review enablement flag exists at this base. Do not turn public review on until the 14-day lookahead and hosted proof exist.

---

# Historical: V1 Gate 0 freeze (2026-09-22)

**Date:** 2026-09-22 (amended 2026-09-22 to match the owner directive then in force)
**Audit tip:** `43f9bc6` (merge of F10 / PR #14)
**Status:** HISTORICAL. Implementation slices G1–G7 in [`plans/active/v1-testflight-finalization.md`](../plans/active/v1-testflight-finalization.md) are closed as a ship program. The text below is preserved so past decisions stay auditable. Where it conflicts with the decision table above, the table wins. Runtime code at `034f1cc` still implements several of these historical values; gates C1–C15 replace that behavior. Do not edit this historical section to make the past look compliant.

## Executive decision

`main` at `43f9bc6` is **not** a production V1 or external TestFlight release candidate. It is suitable only as a **diagnostic internal TestFlight** build with contribution upload, live ads, and subscription purchase/restore **remotely disabled** until Gates 1–7 produce evidence.

F0–F10 source work remains the foundation. Ship readiness is gated by **G0–G7**.

## Frozen decisions

### D1 — Public review cardinality (**global daily 10; 5:00 PM NY rotation**)

**One global set of ten** items per America/New_York review day. Every eligible signed-in reviewer sees the **same ten** items and may submit a correction on any of them.

- Rotation: at **5:00 PM America/New_York** each day, a scheduler
  1. **closes** the current window,
  2. **grants credits** for every submission received during the window that was **not marked unsatisfactory** by an administrator before close,
  3. **pre-selects** the next window's ten items at random from the eligible pool (see D2), and
  4. publishes them for the new window.
- Users can submit **once per item per user per window**. Multiple users may submit corrections for the same item.
- UI copy: **"Today's 10 corrections"** — always show the shared 10 while a window is open; the reward count arrives at close.
- Administrator action **before close** on a submission → no reward for that submission (see D6 non-clawback).
- Hidden synthetic quality checks (`synthetic_qc`) remain a **separate** pool and do not consume the global ten.

### D2 — Corpus eligibility (**all training + benchmark; all eligible for now**)

For V1 review-pool bring-up:

- Every row under `datasets/`, `training/`, and `benchmarks/` is imported into `review_source_items` and marked `public_review_eligible=true`, subject only to:
  - de-identification and PII/safety redaction,
  - deduplication by content hash,
  - license/provenance is recorded but does **not** exclude at this stage.
- Random 10 per rotation from the whole eligible pool.
- **Length-tier credit:**
  - Compute each item's `source_char_length_rank` across the whole imported corpus at import time.
  - Items in the **top 50% longest** at assignment time → **2 credits**.
  - Otherwise → **1 credit**.
  - Length tier is snapshotted onto the item at assignment; later edits do not change it.
- Because contribution corrections are **not** promoted to training or evaluation without a later verification step, we do **not** need to protect benchmark integrity at this review layer. Do **not** re-import review submissions into `benchmarks/gold/` or model training without a separate signed-off migration.
- Contributor known checks remain **separately curated synthetic** rows and are never copied from `benchmarks/gold/`.

### D3 — Sign-in before purchase, restore, or contribution

Supabase Auth + Sign in with Apple is required before:

- Subscription purchase
- Restore Purchases
- Public review / contribution submission
- Contribution rewards

RevenueCat `app_user_id` **must** be the signed-in Supabase UUID before any paywall or restore. Anonymous RevenueCat IDs are not a V1 purchase path.

Core Translate, Camera, History, Settings, and Learn remain **usable without sign-in** (subject to D4 startup consent).

### D4 — Startup consent gate + raw speech-media in V1

**Startup consent gate (everyone, before any product surface):**

On first launch, and again after any consent version bump, every user must acknowledge:

1. **Terms & Conditions** — checkbox required.
2. **Privacy Policy** — checkbox required. Privacy Policy must disclose:
   - Optional Camera photo upload after sign-in,
   - Optional raw microphone / speech-media upload after sign-in,
   - Public-review corrections upload after sign-in,
   - Retention until withdrawal / account deletion; 30-day purge SLA,
   - Contextual (non-personalized) ads default; no ATT/IDFA.
3. **"I am 18 years of age or older."** — checkbox required.

All three must be accepted or the app closes / stays on the consent screen. Consent is stored locally (guests) and re-affirmed and mirrored to `user_consents` on sign-in.

**Raw speech-media upload is in V1 scope.** Flag `contribution_speech_enabled` remains remote-disableable, defaults **off** at first internal build, and turns on after Gate 2 proves:

- deterministic capture URI from STT / recorder,
- signed, private-bucket upload,
- retry queue that never blocks core translation,
- retention → withdrawal → 30-day purge.

**Account-linked collection.** All data collected for signed-in users — speech recordings, camera photos, translation submissions, corrections, and derived rows — must record `user_id`. Withdrawal or account deletion enqueues a purge job that deletes **all** rows and storage objects linked to that `user_id` (raw + derived) within **30 days** and logs completion.

Guests still translate locally without sign-in, but they cannot upload anything.

### D5 — Interstitial timing

Automatic interstitial eligibility requires **15 minutes of foreground-active time since the last successful interstitial impression** (not cumulative lifetime foreground time that never resets). Cap remains **three per America/New_York calendar day**. Quota/timer updates only after a **confirmed impression**. Safe idle opportunities after completed activities are required (Gate 3).

### D6 — Credits (**1 credit = 15 minutes**, no clawback)

- **One credit = 15 minutes** of ad-free time (matches one rewarded-video grant).
- Top-50% longest samples (per D2 rank at assignment) → **2 credits** (30 minutes).
- Otherwise → **1 credit** (15 minutes).
- Rewarded video → **1 credit / 15 minutes**.
- Credits granted at the 5:00 PM close (D1). If an admin marked a submission unsatisfactory before close, that submission grants zero credits.
- **No clawback.** Post-close rejection creates a contributor alert only.
- Subscription or active earned ad-free window suppresses banners, automatic interstitials, and house ads.

### D7 — Ads and TestFlight honesty

- Internal builds and TestFlight: **Google test ad units** only.
- Live network ads and revenue require production unit IDs, UMP/consent handling, AdMob app readiness, and crawlable `app-ads.txt`.
- TestFlight impressions are **not** advertising revenue proof.

### D8 — Rollout flag matrix (defaults)

All optional flags remain independently remote-disableable and **default off** until their gate evidence passes:

| Flag | V1 default until gate | Gate |
|------|----------------------|------|
| `contribution_text_enabled` | off | G1 + G2 |
| `contribution_speech_enabled` | off (turn on after G2 proof) | G2 |
| `contribution_photos_enabled` | off | G2 |
| `network_ads_enabled` | off | G3 |
| `rewarded_ads_enabled` | off | G3 |
| `automatic_interstitial_enabled` | off | G3 + release go/no-go |
| `paywall_enabled` | off | G3 |
| `telemetry_enabled` | off | G5 |
| `deletion_processing_enabled` | off | G2 + G5 |

Internal diagnostic builds keep contribution, live ads, and paywall **off** until each gate produces evidence.

## Exit evidence (Gate 0)

- [x] This decision file (amended)
- [x] [`.governance/DATA_CLASSIFICATION.md`](./DATA_CLASSIFICATION.md)
- [x] INTENT + AGENTS + DONE + ExecPlan + CERTIFICATION + RELEASE_RUNBOOK product-freeze text aligned
- [x] No runtime code in the Gate 0 PR

## Supersedes

- Prior "up to 10 per reviewer per NY day" cardinality — replaced by **global 10/day + 5 PM rotation**.
- Prior "corpus excludes frozen benchmarks / license holds" restriction — replaced by **all corpora eligible for now**, with training / evaluation re-use gated by a separate future verification step.
- Prior ">20 original words = 2 credits" — replaced by **top-50%-longest rank at import**.
- Prior "1 credit = 5 minutes" — replaced by **1 credit = 15 minutes**.
- Prior "raw speech-media deferred from V1 disclosures" — replaced by **speech-media in V1 scope**, disclosed in Privacy Policy, gated by startup consent + `contribution_speech_enabled`.
- Prior "Login only for contributions and rewards" — extended by a **startup T&C / Privacy / 18+ consent gate** for every user.
- Conflicting F0–F10 product-boundary text on any of the above.
