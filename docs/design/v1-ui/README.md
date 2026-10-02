# Native screenshot baseline and proposal intake
Status: **BLOCKED_NATIVE_BASELINE**, 2026-10-01. The current computer-use inventory exposes no native apps or iPhone capture surface. No iPhone 16 screenshot/build manifest has been supplied. No generated designs are claimed.

The owner has authorized a new diagnostic TestFlight build to obtain these originals. [Build evidence](../../../.agent/TESTFLIGHT_SCREENSHOT_BUILD_2026-10-01.md) owns its identity and actual availability; a successful upload is not an installed-device screenshot.

## Capture source
Use the original, currently installed Bola app on a physical iPhone 16, before UI edits. Record app version, build number, Git SHA (or explicitly unknown), device/iOS version, UI language, theme, text size, and the local capture time/timezone. If the installed binary is older than the desired code baseline, label it and reconcile differences before design; do not claim it represents 9aaf493 automatically.
Use synthetic content and a designated test account; exclude personal audio/text/account details. Keep original PNGs unchanged. No painted status bars or browser screenshots passed off as native.
Start with a Settings/About screenshot showing the candidate identity. Updating an existing installation may preserve startup acceptance and completed welcome cards: capture the states that actually appear, and mark unavailable first-launch states as unavailable. Do not erase translation history just to force a popup.

## Screens to capture
- Required Terms/Privacy acceptance with language selection: initial state and Nepali state.
- Existing welcome, ad-free invitation, welcome/daily award and award-animation endpoint. Capture first-ever and returning paths.
- Contribution opt-in in its actual current location, declined and accepted/ready states.
- Today's 10 category cards, one answer, correction, progress/completion and existing Extra 10.
- Translate typed result and saved-mic result with feedback controls; keyboard shown/hidden as relevant.
- Camera capture and expanded/collapsed result with matching highlights; relevant clipboard acknowledgement.
- Settings Account/subscription surface if its design will be changed.
An absent screen/control is recorded as absent; do not generate a fabricated “before.”

## Intake and paths
Save references under docs/design/v1-ui/baseline/ and proposals under docs/design/v1-ui/proposals/. Repository root is C:/Users/maxwe/.cursor/nepaliTranslation.
For each image, record filename, SHA-256, source device/build/state, dimensions, proposed changes, unchanged behavior, generating agent, prompt, output path, inspection result, and owner approval.
[manifest.json](manifest.json) is intentionally empty until native references arrive.

## Generation contract
Use the imagegen skill and built-in image tool. Spawn one separate agent for each proposal after its screenshot is inspected. Each receives exactly its reference, related source constraints, and requested improvement; preserve the actual navigation, app palette, safe areas, state and authorized functionality.
Proposals improve existing screens; no invented rewards, legal claims, sign-in-free uploads, or new modal flow. Terms/Privacy behavior and legal copy require owner sign-off. Generated typography/Nepali is visually checked, never treated as implementation-ready proof.
Return inline images plus absolute original/proposal paths. Persist generated images and prompts; don't use the generated bitmap as an app screen. Implement only after owner approves each proposal.
A matched native after screenshot and iPad check verify implementation later. A drawn proposal itself closes no device/test gate.

## Ready-to-dispatch image brief
After each original has been received and inspected, give one fresh image agent its absolute reference path, verified build/state, related screen source, and one proposed improvement. For startup, simplify reading and policy acceptance while preserving language choice; for Today's 10, emphasize the task and local progress; for typed/audio feedback, integrate thumbs beside the actual result; for Camera, preserve photo/highlight/result correlation. These are design directions awaiting actual references, not approved layouts. Require a saved drawn proposal, full output path and recorded prompt, then visually inspect it before owner review.
