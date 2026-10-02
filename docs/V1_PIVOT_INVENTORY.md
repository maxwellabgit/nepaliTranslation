# Pivot inventory — code at 9aaf493
Read-only source inventory, 2026-10-01. This is not removal, deployment, or device proof.

## Retired server public review
supabase/functions/public-review/index.ts returns HTTP 410 review_retired.
mobile/src/features/contribution/publicReviewApi.ts reads the bundled roster and returns a local submission acknowledgement. ReviewScreen still calls that client, so deleting it would break current Today's 10.
The old service_rotate_review_window/service_plan_review_lookahead definitions remain in historical migrations; no invocation in the current scheduler. Preserve migration history. Review admin and old RPC reachability need a C5/C12 authorization/invocation audit before retirement.

## Scheduled reward close
supabase/functions/process-scheduled-jobs/index.ts still calls service_close_ny_reward_window before deletion. A failed close does not skip deletion. This is a live source connection, not an unused file; retire new-review grant behavior in a forward migration/scheduler change with fresh/upgrade and deletion tests. Preserve old earned balances.

## Local reward remnants
mobile/src/features/contribution/reviewDayItems.ts computes scheduled_credits using reviewCredits.ts. ReviewScreen.tsx still renders review.earnUpTo using active.scheduled_credits. publicReviewApi.ts retains reward metadata and a credit label helper tested in publicReviewApi-test.ts.
These have current references; remove misleading UI in C5 and compatibility fields only after migration/test analysis. Local category/Extra 10 badge coins must stay distinct from spendable ad-free credits.

## Missing actual Today's 10 answer persistence
submitReview validates edit text but returns only local window/item/action metadata. reviewDayStore.ts saves reviewed/consumed IDs and badges; it does not store correctedText. ReviewScreen sends the correction but advances after the local acknowledgement.
C5 must persist answers before acknowledging completion, then authorize and deduplicate upload/retrieval. The >90% sampleAllotment.ts count cannot substitute for those answers.

## Speech-only thumbs
TranslateComposer.tsx exposes onUtteranceFeedback; useTranslationSession.ts updates a saved utterance by ID. C8 must link feedback to the actual translated result and add typed-result feedback without capturing unrelated text or pretending guest data is consented.
media outbox already has feedback revision work; reuse it and verify races/retry rather than building a second queue.

## Closed photo routes and old objects
mediaEnqueue.ts rejects photo and create-media-upload accepts speech only. The October forward migration rejects photo register/complete. Local source guards do not prove the hosted schema/functions were applied.
Historical contribution-photos objects/tables remain subject to withdrawal/account deletion. Legacy photo queue rejection cannot be removed until upgrade/retry coverage shows it is safe. No photo toggle should be offered.

## Ad controller discrepancy
InterstitialController.tsx invokes presentDueRef on a one-second clock and after loading persisted time; native request uses timer_elapsed and translate_idle, web opens SampleVideoAd. The timer path resets after a resolved presentation attempt; the screen opportunity listener resets only when result.presented.
The owner retained the main-branch reset behavior, but the current timer path is not proof of safe-point compliance. C11 must reconcile the paths and test foreground/background, no-fill/failure, active mic/Camera/edit, local grants and subscriptions. No ad-clock code changed in C0.

## Removal disposition
No runtime connection identified above is safely deletable as a docs-only change: each is referenced, shared with deletion, or an upgrade compatibility guard. The current C0 removes contradictory active instructions; C5/C8/C11/C12 own coherent code retirement. No historical migrations, stored objects, or ledger rows were deleted.
