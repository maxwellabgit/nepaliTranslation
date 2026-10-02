# TestFlight — current Bola functional candidate
Updated 2026-10-01. This checklist supersedes [the old build-20 checklist](../docs/history/2026-10-01-contract/TESTFLIGHT.md). That delivery remains historical; no newer accepted/installed binary is asserted.
Contract: [INTENT](../.governance/INTENT.md). Release gates: [runbook](../docs/RELEASE_RUNBOOK.md).

## Candidate identity (fill only from evidence)
- Git SHA: UNRECORDED for a new binary. Source baseline is 9aaf493.
- App version/build: UNRECORDED.
- EAS profile/build ID/submission ID: UNRECORDED.
- Apple processing accepted: NOT VERIFIED.
- Installed iPhone 16 / iPad and iOS version: NOT VERIFIED.
- Runtime server endpoints/feature flags: NOT VERIFIED.

## Profiles
testflight uses Google demo units, no revenue. testflight-ssv uses owner units on registered test devices for callback proof. production is the live App Store path after owner approval and gates.
Build with npx eas build --platform ios --profile testflight.
Submit exactly that build with npx eas submit --platform ios --profile testflight --id <EAS_BUILD_ID>.
Apple upload, processing, installation and public approval are different statuses.

## Native baseline
Capture [the specified iPhone 16 states](../docs/design/v1-ui/README.md) from the current installed app before design. Record exact build/source differences; no browser substitution. Generated proposals are not device proof.

## Functional acceptance on iPhone and iPad
- [ ] Guest offline Translate/Camera/History/Settings/Learn; optional services fail soft.
- [ ] Bilingual Terms/Privacy and language choice, no guest startup account/18+ gate; optional consent remains separate.
- [ ] Welcome ten credits, later New York dates five, no duplicate grant, animation after last popup; cap/stack/restart.
- [ ] Today's 10 category/Extra 10 badges, offline resume, no review reward promises; actual answer retained; strict >90% metric delivered once.
- [ ] Typed and saved-mic result thumbs show selected state and correct source/result association.
- [ ] Eligible signed-in/current-consent/18+/flag uploads reach private storage/admin retrieval once; blocked users upload nothing.
- [ ] At least four clips survive restart/offline; actual audio files ≤60 seconds; queue/revision/concurrent saves lose no unsent data.
- [ ] Camera focus, no-text rejection, three highlights, passage/sheet/copy feedback and temp-file deletion.
- [ ] Idle Translate/Learn test banners, stable 60-second house rotation.
- [ ] Automatic interstitial ten-minute foreground eligibility, safe-point presentation, main reset behavior, background/failure/restart and ad-free suppression.
- [ ] Two-credit signed rewarded grant once, duplicate/failed callback zero extra credits.
- [ ] Localized subscription price, UUID binding, purchase/restore if shipping.
- [ ] Withdrawal/account deletion and queue cleanup; hosted deletion receipts attached separately.
- [ ] Accessibility/text-size/iPad layout and zero material reviewer findings.

No box is checked from source presence, old screenshots or prior-SHA tests. This run creates no build/device/ads/revenue proof.
