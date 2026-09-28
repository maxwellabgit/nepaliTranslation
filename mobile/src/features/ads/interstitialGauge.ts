import { INTERSTITIAL_MIN_FOREGROUND_MS } from '../entitlements/decideInterstitialPresentation';

/** What the credits gauge may show. It is not an ad request. */
export type InterstitialGaugeState = 'countdown' | 'ready' | 'unavailable';

export type InterstitialSuppressionInput = {
  automaticInterstitialEnabled: boolean;
  hasSubscription: boolean;
  earnedAdFreeUntilMs: number | null;
  trustedNowMs: number | null;
  offline: boolean;
  canRequestAds: boolean;
};

/**
 * Durable reasons an automatic interstitial will not show, even at a safe
 * point. Keyboard, recording, and the safe-point wait are not suppression:
 * those still count foreground time and can show "Ad ready".
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
  if (remainingMs === 0) {
    return { state: 'ready', remainingMs: 0 };
  }
  return { state: 'countdown', remainingMs };
}

/** Remaining foreground time until an interstitial may show at a safe point. */
export function formatInterstitialCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
