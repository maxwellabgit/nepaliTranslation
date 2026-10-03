# V1 product decisions
Living contract: **2026-10-01**, baseline `9aaf493`.
Authority: owner instructions, [INTENT](INTENT.md), and [the active ExecPlan](../plans/active/v1-final-contract-reconciliation.md).
The [previous freeze and amendments](../docs/history/2026-10-01-contract/V1_G0_DECISIONS.md) are preserved as history. Nothing here marks runtime or deployment proof complete.

## Current decisions
- Platforms: Expo SDK 57, iOS/iPadOS, English ↔ Nepali, on-device core; no Android release or cloud core inference.
- Navigation: Translate, Camera, Learn only; Account inside Settings; one Today's 10 route.
- Startup: bilingual Terms + Privacy and language choice; no account/18+ for guest core. Optional sharing is a separate opt-in.
- Contribution authorization: signed-in valid session, current consent, 18+, matching flag; speech additionally requires its default-off sharing toggle. Guests stay local; ownerless audio is never adopted by a later account.
- Contribution methods: bundled gamified Today's 10 responses and seamless thumbs feedback for spoken/typed translations. Actual responses must be retained; completion counts alone do not satisfy capture.
- Today's 10: at least 150 distinct bundled meanings; retain category progress and Extra 10 badges, without ad-free rewards. No global review windows, new lookahead imports, automatic cosine/PASS validation, or scheduled review credits.
- Metric: confirm/edit count distinct meaning IDs; strictly >90%, once per subject/manifest. 333/370 does not fire, 334/370 does. Skip/report/open do not count.
- Photos: temporary on-device OCR input only; no new contribution upload or sharing toggle. Historical objects still require authorized deletion processing.
- Standard data: stable IDs and feedback revisions link original source, translation, optional correction/audio, settings and consent. Versioned normalization is separate from original text; idempotent private retrieval/export, no automatic training.
- Audio: real file duration ≤60 seconds; at least four local clips survive offline/slow upload, restart, and queue pressure. Verify actual files, not just duration metadata.
- Daily credits: 10 first-ever installation open; 5 on each later New York date; no same-day extra five. V1 daily-open records do not receive a second welcome. Flight follows the final startup popup.
- Credit duration: ten minutes; preserve remaining time; 12-hour cap. Owner amendment 2026-10-02 retires the filling bar: compact top-right timer pill widens for the increasing time; the coin icon and flight destination remain outside it. Keep the original mountain/coin image within the readable award popup.
- Rewarded ad: two credits / twenty minutes after one verified server callback; preserve historical grants without clawback.
- Automatic ads: ten-minute foreground eligibility, no daily cap, allowlisted safe points only; subscription/local ad-free grants suppress. Main-branch reset behavior stands; timer-triggered presentation is not accepted proof of safe-point compliance.
- Banners: idle Translate/Learn; house rotation 60 seconds foreground-visible; steady slot; no photo/recording/consent/keyboard overlap.
- Subscription: USD 2.99/month US and NPR 199/month Nepal if available; StoreKit localized price; Supabase UUID before purchase/restore.
- Session: rolling 30-day inactivity, short JWT; expiry leaves guest core usable.
- Withdrawal/deletion: stop uploads immediately; durable retry and linked-data purge ≤30 days; auth last on account deletion; preserve core/account on withdrawal.
- Data safety: rights deny-by-default; collected content private; exposure hashes excluded from train/eval; gold unchanged; raw content excluded from telemetry and bundles.
- UI design: current physical iPhone 16 screenshots with build/state provenance; separate agent per generated proposal; full absolute before/after paths; owner approves proposals before runtime changes.
- Distribution: test units/no revenue in TestFlight; owner units/readiness/UMP/app-ads.txt for production; owner-controlled live enablement.
- Model work: no training/optimization in this functional finalization; preserve recorded certificate and thresholds. No certification waiver inferred from owner prioritization.

## Evidence and rollout
2026-10-02 scoped owner direction: implement the explicitly specified first-ever/daily award popup and compact timer changes after review of continuous browser recordings. This authorizes this C4 UI slice directly; it does not satisfy C1 native baseline/design proof or approve unrelated redesigns. A single readable award replaces Welcome and Go ad-free; Continue dismisses it before non-blocking flight over Home. Record both changed browser journeys, without claiming native proof.

Every optional subsystem remains off until its code, server authorization, hosted round trip, and device proof pass. Text and speech are independent flags. Retired photo/public-review flags must not resurrect old flows. The scheduler's remaining historical reward-close call is inventoried, not approved for new review grants.
C0–C15 are revalidated against the revised contract. Historical PASS entries remain historical; [current state](../.agent/V1_FINAL_CONTRACT_STATE.md) owns readiness.

## Owner amendments, 2026-10-02 follow-up
Today's 10 completion means every question in a set has a nonempty submitted answer. Skip remains unanswered; a written report/neither response can complete a question while remaining excluded from the strict >90% confirm/edit metric. Completed sets remain editable, with original and revised responses retained as separate owner-bound submissions; older batches remain reopenable. Each category offers subsequent Extra 10 sets until the bundled roster is exhausted. The thanks page alone shows the countdown to the next 5 PM America/New_York; the next deadline follows the local calendar, including DST.
The Translate action fills the dock to the microphone's right and is green. These exact owner-directed edits use the supplied image; no new screenshot/recording or native C1 closure is implied.
Ad skip after confirmed presentation grants one local credit with one coin. Full rewarded completion displays two credits/twenty minutes with two coins; permanent native stacking requires the exact authenticated SSV session receipt, never aggregate expiry or a provisional balance copied into durable grants. Errors/no impression grant nothing. Existing clock reset policy and twelve-hour cap stand.
The engineering testing ground automatically warms the existing pinned IndicTrans2 bundles using browser-local WASM. It does not claim native performance or model-quality certification. Reset clears its timers to zero once per reset request without repeating on ordinary remount. No PC/cloud inference is introduced into the iOS product path.
- Owner UI follow-up2026-10-02: focus-only180ms Send; no input count/speaker/companion line; gold formality/script/language/navigation/static surfaces, no formality for NEsource; output22px normal font; NEsource prompt/Send/feedback follows script; Settings global RomanizedNepali UI variant; persistent sharedtimer; identical localHome/History edit with original row settings, no credit, adjacentSave/Cancel and outside dismissal; reliable serialized HistoryClear; sampleBack/draftpreservation; source-owned terminalpunctuation with quote/abbreviation/decimal handling. Full native/hosted proofs remain open.
