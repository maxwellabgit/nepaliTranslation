/**
 * Pure automatic-interstitial policy (F5).
 * AdMob SDK owns presentation and dismissal — this only decides eligibility.
 */

export const INTERSTITIAL_MIN_FOREGROUND_MS = 15 * 60 * 1000;
export const INTERSTITIAL_MAX_PER_NY_DAY = 3;

/** Safe vs forbidden transition kinds for automatic interstitial. */
export type InterstitialTransition =
  | 'idle_after_task'
  | 'launch'
  | 'exit'
  | 'resume'
  | 'tab_press'
  | 'permission'
  | 'error_recovery'
  | 'camera'
  | 'result_review';

export type InterstitialSurface = 'translate_idle' | 'learn_landing';

export type DecideInterstitialPresentationInput = {
  automaticInterstitialEnabled: boolean;
  hasSubscription: boolean;
  earnedAdFreeUntilMs: number | null;
  trustedNowMs: number | null;
  offline: boolean;
  canRequestAds?: boolean;
  appActive?: boolean;
  modalVisible?: boolean;
  keyboardVisible?: boolean;
  listening?: boolean;
  speaking?: boolean;
  translating?: boolean;
  /** True while a translation/OCR result is still on screen for review. */
  resultUnderReview?: boolean;
  /** True while Camera pane is the active mode. */
  cameraActive?: boolean;
  transition: InterstitialTransition;
  surface: InterstitialSurface;
  /** Cumulative foreground-active milliseconds (device clock OK). */
  foregroundActiveMs: number;
  /** Presentations already counted for the current America/New_York calendar day. */
  presentationsTodayNy: number;
  minForegroundMs?: number;
  maxPerNyDay?: number;
};

export type InterstitialDecision =
  | { show: false; reason: string }
  | { show: true };

/**
 * Priority:
 * 1. remote flag off / subscription / earned ad-free → none
 * 2. offline / UMP block → none (never call network offline)
 * 3. forbidden transition or Camera / result review / busy chrome → none
 * 4. foreground < 15 min or ≥ 3 presentations this NY day → none
 * 5. else → show (SDK presents)
 */
export function decideInterstitialPresentation(
  input: DecideInterstitialPresentationInput,
): InterstitialDecision {
  const minFg = input.minForegroundMs ?? INTERSTITIAL_MIN_FOREGROUND_MS;
  const maxDay = input.maxPerNyDay ?? INTERSTITIAL_MAX_PER_NY_DAY;

  if (!input.automaticInterstitialEnabled) {
    return { show: false, reason: 'flag_off' };
  }
  if (input.hasSubscription) {
    return { show: false, reason: 'subscription' };
  }
  if (
    input.trustedNowMs !== null &&
    input.earnedAdFreeUntilMs !== null &&
    input.earnedAdFreeUntilMs > input.trustedNowMs
  ) {
    return { show: false, reason: 'earned_ad_free' };
  }
  if (input.offline) {
    return { show: false, reason: 'offline' };
  }
  if (input.canRequestAds === false) {
    return { show: false, reason: 'ump_blocks' };
  }
  if (input.appActive === false) {
    return { show: false, reason: 'inactive' };
  }
  if (input.cameraActive || input.transition === 'camera') {
    return { show: false, reason: 'camera' };
  }
  if (input.resultUnderReview || input.transition === 'result_review') {
    return { show: false, reason: 'result_review' };
  }
  if (input.modalVisible) {
    return { show: false, reason: 'modal' };
  }
  if (input.keyboardVisible) {
    return { show: false, reason: 'keyboard' };
  }
  if (input.listening || input.speaking) {
    return { show: false, reason: 'audio' };
  }
  if (input.translating) {
    return { show: false, reason: 'translating' };
  }

  if (input.transition !== 'idle_after_task') {
    return { show: false, reason: `transition_${input.transition}` };
  }

  if (
    input.surface !== 'translate_idle' &&
    input.surface !== 'learn_landing'
  ) {
    return { show: false, reason: 'surface' };
  }

  if (input.foregroundActiveMs < minFg) {
    return { show: false, reason: 'foreground_gate' };
  }
  if (input.presentationsTodayNy >= maxDay) {
    return { show: false, reason: 'daily_cap' };
  }

  return { show: true };
}
