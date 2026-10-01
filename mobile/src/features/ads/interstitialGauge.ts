import { INTERSTITIAL_MIN_FOREGROUND_MS } from '../entitlements/decideInterstitialPresentation';

/** What the credits gauge may show. Zero remaining means the ad is due now. */
export type InterstitialGaugeState = 'countdown' | 'unavailable';

export type InterstitialSuppressionInput = {
  automaticInterstitialEnabled: boolean;
  hasSubscription: boolean;
  earnedAdFreeUntilMs: number | null;
  trustedNowMs: number | null;
  offline: boolean;
  canRequestAds: boolean;
};

/**
 * Durable reasons the automatic video stays off. While the app is open and
 * ads are allowed, the clock counts down and the video shows at zero.
 */
export function interstitialAdsSuppressed(
  input: InterstitialSuppressionInput,
): boolean {
  if (!input.automaticInterstitialEnabled) return true;
  if (input.hasSubscription) return true;
  if (input.offline) return true;
  if (!input.canRequestAds) return true;
  if (
    input.trustedNowMs !== null &&
    input.earnedAdFreeUntilMs !== null &&
    input.earnedAdFreeUntilMs > input.trustedNowMs
  ) {
    return true;
  }
  return false;
}

/** True when the visible countdown has hit zero and the video should interrupt. */
export function interstitialInterruptDue(
  input: InterstitialSuppressionInput & { foregroundActiveMs: number },
): boolean {
  if (interstitialAdsSuppressed(input)) return false;
  const elapsed = Number.isFinite(input.foregroundActiveMs)
    ? Math.max(0, input.foregroundActiveMs)
    : 0;
  return elapsed >= INTERSTITIAL_MIN_FOREGROUND_MS;
}

export function interstitialGauge(input: {
  foregroundActiveMs: number;
  suppressed: boolean;
  minForegroundMs?: number;
}): { state: InterstitialGaugeState; remainingMs: number } {
  if (input.suppressed) {
    return { state: 'unavailable', remainingMs: 0 };
  }
  const min = input.minForegroundMs ?? INTERSTITIAL_MIN_FOREGROUND_MS;
  const elapsed = Number.isFinite(input.foregroundActiveMs)
    ? Math.max(0, input.foregroundActiveMs)
    : 0;
  const remainingMs = Math.max(0, min - elapsed);
  return { state: 'countdown', remainingMs };
}

/** Remaining foreground time until the interrupting video. */
export function formatInterstitialCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
