/**
 * Pure ad policy. Callers must pass trustedNowMs from a synced clock —
 * never raw Date.now() for earned-window checks. When trusted time is unknown,
 * treat as not earned-ad-free (fail closed for suppression; still may show ads).
 */

export type AdSurface =
  | 'translate_idle'
  | 'translate_result'
  | 'learn_landing'
  | 'contribution_result'
  | 'conversation'
  | 'keyboard'
  | 'audio'
  | 'translating'
  | 'home'
  | 'history'
  | 'settings'
  | 'learn'
  | 'quiz';

/** Allowed banner placements (F5 / INTENT): idle Translate + Learn landing only. */
export const ALLOWED_BANNER_PLACEMENTS = [
  'translate_idle',
  'learn_landing',
] as const;

export type AllowedBannerPlacement = (typeof ALLOWED_BANNER_PLACEMENTS)[number];

export type AdDecision =
  | { show: false; reason: string }
  | { show: true; kind: 'banner' | 'house' | 'rewarded' };

export type DecideAdPresentationInput = {
  surface: AdSurface;
  networkAdsEnabled: boolean;
  rewardedAdsEnabled?: boolean;
  hasSubscription: boolean;
  earnedAdFreeUntilMs: number | null;
  trustedNowMs: number | null;
  offline: boolean;
  /** UMP: false → house (online) / none for rewarded. */
  canRequestAds?: boolean;
  appActive?: boolean;
  modalVisible?: boolean;
  keyboardVisible?: boolean;
  listening?: boolean;
  speaking?: boolean;
  translating?: boolean;
  /** Last network banner show (trusted or device clock for cooldown). */
  lastNetworkBannerAtMs?: number | null;
  /** Last house banner show. */
  lastHouseBannerAtMs?: number | null;
  nowMs?: number;
  networkBannerCooldownMs?: number;
  houseBannerCooldownMs?: number;
  /** Rewarded video only after an explicit user tap. */
  explicitRewardedRequest?: boolean;
};

const DEFAULT_NETWORK_COOLDOWN = 12 * 60 * 1000;
const DEFAULT_HOUSE_COOLDOWN = 24 * 60 * 1000;

function isAllowedPlacement(
  surface: AdSurface,
): surface is AllowedBannerPlacement {
  return (ALLOWED_BANNER_PLACEMENTS as readonly string[]).includes(surface);
}

function inCooldown(
  lastAt: number | null | undefined,
  now: number,
  cooldownMs: number,
): boolean {
  if (lastAt == null) return false;
  return now - lastAt < cooldownMs;
}

/**
 * Priority:
 * 1. subscription / earned window → none
 * 2. inactive / modal / keyboard / audio / translation / Conversation → none
 * 3. offline → house (24m cooldown) on allowed placements
 * 4. online but UMP blocks requests → house
 * 5. eligible online → adaptive banner (12m cooldown)
 * 6. rewarded only after explicitRewardedRequest (and flags/UMP/online)
 */
export function decideAdPresentation(
  input: DecideAdPresentationInput,
): AdDecision {
  const now = input.nowMs ?? input.trustedNowMs ?? 0;
  const networkCooldown =
    input.networkBannerCooldownMs ?? DEFAULT_NETWORK_COOLDOWN;
  const houseCooldown = input.houseBannerCooldownMs ?? DEFAULT_HOUSE_COOLDOWN;

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

  if (input.appActive === false) {
    return { show: false, reason: 'inactive' };
  }
  if (input.modalVisible) {
    return { show: false, reason: 'modal' };
  }
  if (input.keyboardVisible || input.surface === 'keyboard') {
    return { show: false, reason: 'keyboard' };
  }
  if (input.listening || input.speaking || input.surface === 'audio') {
    return { show: false, reason: 'audio' };
  }
  if (input.translating || input.surface === 'translating') {
    return { show: false, reason: 'translating' };
  }
  if (input.surface === 'conversation') {
    return { show: false, reason: 'conversation' };
  }
  if (input.surface === 'quiz') {
    return { show: false, reason: 'quiz' };
  }

  // Explicit rewarded path — never auto-load.
  if (input.explicitRewardedRequest) {
    if (!input.rewardedAdsEnabled) {
      return { show: false, reason: 'rewarded_flag_off' };
    }
    if (input.offline) {
      return { show: false, reason: 'rewarded_offline' };
    }
    if (input.canRequestAds === false) {
      return { show: false, reason: 'ump_blocks' };
    }
    return { show: true, kind: 'rewarded' };
  }

  if (!input.networkAdsEnabled) {
    return { show: false, reason: 'flag_off' };
  }

  if (!isAllowedPlacement(input.surface)) {
    return { show: false, reason: 'placement' };
  }

  if (input.offline) {
    if (inCooldown(input.lastHouseBannerAtMs, now, houseCooldown)) {
      return { show: false, reason: 'house_cooldown' };
    }
    return { show: true, kind: 'house' };
  }

  if (input.canRequestAds === false) {
    if (inCooldown(input.lastHouseBannerAtMs, now, houseCooldown)) {
      return { show: false, reason: 'house_cooldown' };
    }
    return { show: true, kind: 'house' };
  }

  if (inCooldown(input.lastNetworkBannerAtMs, now, networkCooldown)) {
    return { show: false, reason: 'banner_cooldown' };
  }

  return { show: true, kind: 'banner' };
}
