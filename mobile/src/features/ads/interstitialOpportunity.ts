import {
  decideInterstitialPresentation,
  type DecideInterstitialPresentationInput,
  type InterstitialDecision,
  type InterstitialTransition,
} from '../entitlements/decideInterstitialPresentation';
import type { AdAdapter } from './adMiddleware';
import {
  loadForegroundActiveMs,
  loadInterstitialDayState,
  recordInterstitialPresentation,
  saveForegroundActiveMs,
} from './foregroundAdTimer';

export type TryPresentInterstitialInput = Omit<
  DecideInterstitialPresentationInput,
  'foregroundActiveMs' | 'presentationsTodayNy'
> & {
  adapter: AdAdapter;
  interstitialUnitId: string;
  /** Override clocks/counters in tests. */
  foregroundActiveMs?: number;
  presentationsTodayNy?: number;
  nowMs?: number;
};

export type TryPresentInterstitialResult = {
  decision: InterstitialDecision;
  presented: boolean;
  executed: string;
};

/**
 * Evaluate policy and, when allowed, load+show via the AdMob adapter.
 * SDK owns dismiss — no custom skip UI. Offline / flag-off never touch network.
 */
export async function tryPresentInterstitial(
  input: TryPresentInterstitialInput,
): Promise<TryPresentInterstitialResult> {
  const nowMs = input.nowMs ?? Date.now();
  const foregroundActiveMs =
    input.foregroundActiveMs ?? (await loadForegroundActiveMs());
  const day =
    input.presentationsTodayNy != null
      ? { count: input.presentationsTodayNy }
      : await loadInterstitialDayState(nowMs);

  const decision = decideInterstitialPresentation({
    automaticInterstitialEnabled: input.automaticInterstitialEnabled,
    hasSubscription: input.hasSubscription,
    earnedAdFreeUntilMs: input.earnedAdFreeUntilMs,
    trustedNowMs: input.trustedNowMs,
    offline: input.offline,
    canRequestAds: input.canRequestAds,
    appActive: input.appActive,
    modalVisible: input.modalVisible,
    keyboardVisible: input.keyboardVisible,
    listening: input.listening,
    speaking: input.speaking,
    translating: input.translating,
    resultUnderReview: input.resultUnderReview,
    cameraActive: input.cameraActive,
    transition: input.transition,
    surface: input.surface,
    foregroundActiveMs,
    presentationsTodayNy: day.count,
  });

  if (!decision.show) {
    return {
      decision,
      presented: false,
      executed: `none:${decision.reason}`,
    };
  }

  if (!input.interstitialUnitId) {
    return {
      decision: { show: false, reason: 'missing_unit' },
      presented: false,
      executed: 'none:missing_unit',
    };
  }

  if (input.offline) {
    return {
      decision: { show: false, reason: 'offline' },
      presented: false,
      executed: 'none:offline',
    };
  }

  await input.adapter.loadInterstitial(input.interstitialUnitId);
  await input.adapter.showInterstitial(input.interstitialUnitId);
  await recordInterstitialPresentation(nowMs);
  return {
    decision,
    presented: true,
    executed: 'interstitial',
  };
}

/** Persist a flushed foreground total (Lifecycle / controller). */
export async function persistForegroundActiveMs(ms: number): Promise<void> {
  await saveForegroundActiveMs(ms);
}

export type { InterstitialTransition };
