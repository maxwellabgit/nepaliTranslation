import {
  decideInterstitialPresentation,
  type DecideInterstitialPresentationInput,
  type InterstitialDecision,
  type InterstitialSurface,
  type InterstitialTransition,
} from '../entitlements/decideInterstitialPresentation';
import type { AdAdapter } from './adMiddleware';
import {
  loadForegroundActiveMs,
  loadInterstitialDayState,
  recordInterstitialPresentation,
  resetForegroundActiveMs,
  saveForegroundActiveMs,
} from './foregroundAdTimer';
import { resolveAdUnitConfig } from './adConfig';

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

  try {
    await input.adapter.loadInterstitial(input.interstitialUnitId);
  } catch {
    return {
      decision: { show: false, reason: 'load_failed' },
      presented: false,
      executed: 'none:load_failed',
    };
  }
  const result = await input.adapter.showInterstitial(input.interstitialUnitId);
  if (!result?.impression) {
    // No confirmed impression -> do NOT count toward daily cap and do NOT
    // reset the "minutes since last successful impression" timer.
    return {
      decision: { show: false, reason: 'no_impression' },
      presented: false,
      executed: 'none:no_impression',
    };
  }
  await recordInterstitialPresentation(nowMs);
  // G3: interstitial eligibility resets to "15 minutes since last successful
  // impression" instead of accumulating cumulative foreground time forever.
  await resetForegroundActiveMs();
  return {
    decision,
    presented: true,
    executed: 'interstitial',
  };
}

export type InterstitialOpportunityRequest = {
  transition: InterstitialTransition;
  surface: InterstitialSurface;
  cameraActive?: boolean;
  resultUnderReview?: boolean;
  modalVisible?: boolean;
  keyboardVisible?: boolean;
  listening?: boolean;
  speaking?: boolean;
  translating?: boolean;
  hasSubscription?: boolean;
};

export type RunInterstitialOpportunityInput = {
  automaticInterstitialEnabled: boolean;
  offline: boolean;
  canRequestAds: boolean;
  appActive: boolean;
  earnedAdFreeUntilMs: number | null;
  trustedNowMs: number | null;
  foregroundActiveMs: number;
  adapter: AdAdapter;
  req: InterstitialOpportunityRequest;
};

/**
 * Controller entry: resolve unit IDs + policy, then optionally present.
 * Soft-fails (no throw) when config is invalid or flag is off.
 */
export async function runInterstitialOpportunity(
  input: RunInterstitialOpportunityInput,
): Promise<TryPresentInterstitialResult | { presented: false; executed: string }> {
  if (!input.automaticInterstitialEnabled) {
    return { presented: false, executed: 'none:flag_off' };
  }
  let interstitialUnitId = '';
  try {
    interstitialUnitId = resolveAdUnitConfig().interstitialUnitId;
  } catch {
    return { presented: false, executed: 'none:bad_config' };
  }
  if (!interstitialUnitId) {
    return { presented: false, executed: 'none:missing_unit' };
  }
  return tryPresentInterstitial({
    automaticInterstitialEnabled: input.automaticInterstitialEnabled,
    hasSubscription: input.req.hasSubscription ?? false,
    earnedAdFreeUntilMs: input.earnedAdFreeUntilMs,
    trustedNowMs: input.trustedNowMs,
    offline: input.offline,
    canRequestAds: input.canRequestAds,
    appActive: input.appActive,
    modalVisible: input.req.modalVisible,
    keyboardVisible: input.req.keyboardVisible,
    listening: input.req.listening,
    speaking: input.req.speaking,
    translating: input.req.translating,
    resultUnderReview: input.req.resultUnderReview,
    cameraActive: input.req.cameraActive,
    transition: input.req.transition,
    surface: input.req.surface,
    foregroundActiveMs: input.foregroundActiveMs,
    adapter: input.adapter,
    interstitialUnitId,
  });
}

/** Persist a flushed foreground total (Lifecycle / controller). */
export async function persistForegroundActiveMs(ms: number): Promise<void> {
  await saveForegroundActiveMs(ms);
}

export type { InterstitialTransition, InterstitialSurface };
