export type AdSurface =
  | 'home'
  | 'history'
  | 'settings'
  | 'learn'
  | 'conversation'
  | 'keyboard'
  | 'audio'
  | 'translating';

export type AdDecision =
  | { show: false; reason: string }
  | { show: true; kind: 'banner' | 'house' };

/**
 * Pure ad policy. Ads stay mocked/off until Slice 08; this encodes the rules.
 * Conversation, keyboard, audio, and active translation never show ads.
 * Callers must pass trustedNowMs from a synced clock — never raw Date.now().
 * When trusted time is unknown, treat as not earned-ad-free (fail closed).
 */
export function decideAdPresentation(input: {
  surface: AdSurface;
  networkAdsEnabled: boolean;
  hasSubscription: boolean;
  earnedAdFreeUntilMs: number | null;
  trustedNowMs: number | null;
  offline: boolean;
}): AdDecision {
  if (
    input.surface === 'conversation' ||
    input.surface === 'keyboard' ||
    input.surface === 'audio' ||
    input.surface === 'translating'
  ) {
    return { show: false, reason: 'blocked_surface' };
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
  if (!input.networkAdsEnabled) {
    return { show: false, reason: 'flag_off' };
  }
  if (input.offline) {
    return { show: true, kind: 'house' };
  }
  return { show: true, kind: 'banner' };
}
