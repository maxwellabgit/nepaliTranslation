/**
 * REVIEW MARK — not a live ad.
 *
 * Call this when the credits-bar countdown reaches 0:00. That is 15 minutes
 * of foreground-active time since the last confirmed interstitial impression
 * (`INTERSTITIAL_MIN_FOREGROUND_MS`).
 *
 * Intended next step, for review before any SDK wiring:
 * present a video ad that the viewer can skip after 5 seconds.
 * Keep the existing safe points (Translate Send, Camera capture, Learn
 * activity-complete). Do not show it on launch, mid-speech, or over a modal.
 */
export function markSkippableVideoAdDue(): void {
  // Intentionally empty. The countdown UI calls this so the hook is easy to find.
}
