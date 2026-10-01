# V1 product decisions

**2026-10-01 superseding notes.** These override the table below where they conflict. Historical rows stay as history.

- Welcome credit is **10** once per installation. Each later New York date grants **5**. A stored v1 daily-open record already used the welcome. Same-day grants stay. The flight starts when the last startup popup closes.
- Bundled samples are on-device meanings. A crossing is strict **> 90%** of distinct `meaning_id`s (333/370 does not fire; 334/370 does). Confirm and edit count. Open, skip, and report do not. The record is not a reward.
- New Camera photo uploads are closed. Speech remains the only new contribution media. Historical photo objects are not purged by this change.
- The interrupt-until-presented interstitial is removed. Daily-open ad-free time still suppresses the automatic interstitial.

**Living contract date:** 2026-09-23
**Selected base:** `034f1cc66b991bf5c7ba5062bfebee7ec87f1d42` (`origin/cursor/v1-r6-r9-blockers-5907`), a verified descendant of `origin/main` `71c85df5a4a7ba238c3496ed243ea0b25b027d91`
**Authority:** [`plans/active/v1-final-contract-reconciliation.md`](../plans/active/v1-final-contract-reconciliation.md) and [`.governance/INTENT.md`](./INTENT.md)
**Status:** The decision table below is the living contract. The 2026-09-22 Gate 0 freeze that follows is **historical evidence**. Do not implement the historical numbers when they conflict.

## Decision table (final contract)

| Topic | Required value | Supersedes |
|-------|----------------|------------|
| Review credits | **1** credit when snapshotted original source words are 1–4; **2** credits when 5–6; **3** credits when 7 or more. Empty text is not planned and schedules 0. Delivered at the next sign-in after the 5:00 PM New York close | 0–20 words → 2 and 21+ → 4, and the older top-half percentile tiers |
| Credit duration | **10** ad-free minutes per credit. New time stacks on time still left. The timer hard-stops at **12 hours** | Any 5-minute or 15-minute credit, and a clock that starts at close while the reviewer is offline |
| Gauge | **50** credits of remaining ad-free time is a visual full mark. It is not printed and it does not cap earning. When the inner bar is full, that fill turns red. The pill and the clock stay the same size and color | A numeric credit cap drawn on the gauge |
| Rewarded ad | **2** credits (20 minutes) after one server-verified confirmation. Same timer and same gauge mark as review credits | 1 credit / 15 minutes per rewarded view |
| Review lookahead | Minimum **14** New York days before public review is enabled; target **28**; every 14 days append, never reshuffle | Same-day random 10 with no private horizon |
| Session inactivity | **30 days**, rolling, on refresh; JWT stays short | Indefinite Supabase auto-refresh |
| Interstitial cap | **None.** Eligibility after 10 minutes of foreground-active time since the last confirmed impression; display only at Translate Send, Camera capture, and Learn idle-return safe points | Three per America/New_York day |
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

`main` at `43f9bc6` was **not** a production V1 or external TestFlight release candidate. At that date it was suitable only as a **diagnostic internal TestFlight** build with contribution upload, live ads, and subscription purchase/restore **remotely disabled** until Gates 1–7 produced evidence.

F0–F10 source work remained the foundation. On 2026-09-22, ship readiness was described as gated by **G0–G7**. That description is historical.

## Frozen decisions

> Present tense in D1–D8 is the 2026-09-22 freeze, quoted as it was written. The decision table at the top of this file wins wherever they conflict.

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

### D6 — Credits (**1 credit = 10 minutes**, no clawback)

Owner revision 2026-09-29. The 2026-09-22 freeze used a top-50% length split (2 credits or 1 credit) and a 1-credit rewarded video. That split is not the rule. Word count, snapshotted at assignment, is.

- **One credit = 10 minutes** of ad-free time.
- **4 words or fewer → 1 credit** (10 minutes).
- **5 or 6 words → 2 credits** (20 minutes).
- **7 words or more → 3 credits** (30 minutes).
- Empty or invalid source text is rejected before planning and earns nothing.
- Rewarded video → **2 credits / 20 minutes**, and it adds to the same timer.
- The Home gauge treats **50 credits** of remaining ad-free time as a visual full mark. That mark is not an earning cap and is not printed. When the inner bar is full, that fill turns red. The pill and the clock stay the same size and color.
- The ad-free timer stacks on time still left and hard-stops at **12 hours**.
- The **5:00 PM America/New_York** close decides the credits. Use the IANA timezone. The reviewer receives them at the next sign-in after that close, including a later day: an award message, then coins flying into the Home timer, then the timer pumping up to the time those credits are worth. If an admin marked a submission unsatisfactory before close, that submission grants zero credits.
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

## Supersedes (historical, 2026-09-22 only)

> This list records what the 2026-09-22 amendment replaced. It is not the living contract. The decision table at the top of this file supersedes this list. In particular, top-50%-longest credits and a universal 18+ startup gate are no longer in force. Word-count rewards are 1, 2, or 3 credits (4 or fewer / 5–6 / 7 or more words). 18+ applies to contribution features.

- Prior "up to 10 per reviewer per NY day" cardinality — replaced, on 2026-09-22, by **global 10/day + 5 PM rotation**.
- Prior "corpus excludes frozen benchmarks / license holds" restriction — replaced by **all corpora eligible for now**, with training / evaluation re-use gated by a separate future verification step.
- Prior ">20 original words = 2 credits" — replaced by **top-50%-longest rank at import**.
- Prior "1 credit = 5 minutes" — replaced by **1 credit = 15 minutes**.
- Prior "raw speech-media deferred from V1 disclosures" — replaced by **speech-media in V1 scope**, disclosed in Privacy Policy, gated by startup consent + `contribution_speech_enabled`.
- Prior "Login only for contributions and rewards" — extended by a **startup T&C / Privacy / 18+ consent gate** for every user.
- Conflicting F0–F10 product-boundary text on any of the above.
