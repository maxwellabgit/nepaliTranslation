/**
 * Pure automatic-interstitial policy (F5).
 * AdMob SDK owns presentation and dismissal — this only decides eligibility.
 */

export const INTERSTITIAL_MIN_FOREGROUND_MS = 15 * 60 * 1000;

/** The only transitions that may present an automatic interstitial. */
export const SAFE_INTERSTITIAL_TRANSITIONS = [
  'translate_send_committed',
  'camera_capture_committed',
  'learn_activity_completed',
] as const;

export type SafeInterstitialTransition =
  (typeof SAFE_INTERSTITIAL_TRANSITIONS)[number];

/** Safe vs forbidden transition kinds for automatic interstitial. */
export type InterstitialTransition =
  | SafeInterstitialTransition
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
  /**
   * Retained for analytics callers. It does not gate presentation.
   */
  presentationsTodayNy?: number;
  minForegroundMs?: number;
};

export type InterstitialDecision =
  | { show: false; reason: string }
  | { show: true };

/**
 * Priority:
 * 1. remote flag off / subscription / earned ad-free → none
 * 2. offline / UMP block → none (never call network offline)
 * 3. forbidden transition or Camera / result review / busy chrome → none
 * 4. foreground < 15 min → pending only, do not show
 * 5. only translate_send_committed, camera_capture_committed, and
 *    learn_activity_completed may show. There is no daily cap.
 */
export function decideInterstitialPresentation(
  input: DecideInterstitialPresentationInput,
): InterstitialDecision {
  const minFg = input.minForegroundMs ?? INTERSTITIAL_MIN_FOREGROUND_MS;
  const safe = (SAFE_INTERSTITIAL_TRANSITIONS as readonly string[]).includes(
    input.transition,
  );

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
  if (
    (input.cameraActive || input.transition === 'camera') &&
    input.transition !== 'camera_capture_committed'
  ) {
    return { show: false, reason: 'camera' };
  }
  if (
    (input.resultUnderReview || input.transition === 'result_review') &&
    input.transition !== 'translate_send_committed'
  ) {
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

  if (!safe) {
    return { show: false, reason: `transition_${input.transition}` };
  }

  if (input.foregroundActiveMs < minFg) {
    return { show: false, reason: 'foreground_gate' };
  }

  return { show: true };
}
