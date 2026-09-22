import {
  decideAdPresentation,
  type AdDecision,
  type AdSurface,
  type DecideAdPresentationInput,
} from '../entitlements/decideAdPresentation';
import {
  HOUSE_BANNER_COOLDOWN_MS,
  NETWORK_BANNER_COOLDOWN_MS,
} from './adConfig';

export type AdNetworkCall = {
  kind:
    | 'banner_load'
    | 'banner_show'
    | 'rewarded_load'
    | 'rewarded_show'
    | 'interstitial_load'
    | 'interstitial_show';
  unitId: string;
  atMs: number;
};

/**
 * Narrow adapter surface. Real AdMob plugs in behind this in a native build;
 * tests and Expo Go use the mock.
 */
export type AdAdapter = {
  loadBanner: (unitId: string) => Promise<void>;
  showBanner: (unitId: string) => Promise<void>;
  loadRewarded: (unitId: string, opts?: RewardedLoadOpts) => Promise<void>;
  /** Resolves with earned=true only after the client reward callback (EARNED_REWARD). */
  showRewarded: (unitId: string) => Promise<{ earned: boolean }>;
  loadInterstitial: (unitId: string) => Promise<void>;
  /**
   * SDK owns presentation and dismissal — no custom skip UI.
   *
   * Resolves with `impression=true` only after the AdMob SDK reports a
   * successful ad presentation (`AdEventType.IMPRESSION` / `CLOSED` after
   * a real show). Any load/show error resolves with `impression=false`
   * so the caller does not falsely count the impression toward quota or
   * reset the "since last successful impression" timer.
   */
  showInterstitial: (unitId: string) => Promise<{ impression: boolean }>;
  showHouseAd: (surface: AdSurface) => void;
  /** Test/observability: network-bound AdMob invocations only. */
  networkCalls: () => AdNetworkCall[];
};

export type RewardedLoadOpts = {
  userId?: string;
  customData?: string;
};

export type AdPlan =
  | { action: 'none'; reason: string }
  | { action: 'house'; surface: AdSurface }
  | { action: 'banner'; unitId: string }
  | { action: 'rewarded'; unitId: string }
  | { action: 'blocked_offline_network' };

export type PlanAdPlacementInput = DecideAdPresentationInput & {
  bannerUnitId: string;
  rewardedUnitId?: string;
};

export function planAdPlacement(input: PlanAdPlacementInput): AdPlan {
  const decision: AdDecision = decideAdPresentation({
    ...input,
    networkBannerCooldownMs:
      input.networkBannerCooldownMs ?? NETWORK_BANNER_COOLDOWN_MS,
    houseBannerCooldownMs:
      input.houseBannerCooldownMs ?? HOUSE_BANNER_COOLDOWN_MS,
  });
  if (!decision.show) {
    return { action: 'none', reason: decision.reason };
  }
  if (decision.kind === 'house') {
    return { action: 'house', surface: input.surface };
  }
  if (decision.kind === 'rewarded') {
    const unitId = input.rewardedUnitId ?? '';
    if (!unitId) return { action: 'none', reason: 'missing_rewarded_unit' };
    if (input.offline) return { action: 'blocked_offline_network' };
    return { action: 'rewarded', unitId };
  }
  if (input.offline) {
    // Defense in depth: never schedule a network load while offline.
    return { action: 'blocked_offline_network' };
  }
  return { action: 'banner', unitId: input.bannerUnitId };
}

/** Execute a plan. Offline paths must not touch network AdMob methods. */
export async function executeAdPlan(
  plan: AdPlan,
  adapter: AdAdapter,
  rewardedOpts?: RewardedLoadOpts,
): Promise<{ executed: string }> {
  switch (plan.action) {
    case 'none':
      return { executed: `none:${plan.reason}` };
    case 'house':
      adapter.showHouseAd(plan.surface);
      return { executed: 'house' };
    case 'blocked_offline_network':
      return { executed: 'blocked_offline_network' };
    case 'banner':
      await adapter.loadBanner(plan.unitId);
      await adapter.showBanner(plan.unitId);
      return { executed: 'banner' };
    case 'rewarded': {
      await adapter.loadRewarded(plan.unitId, rewardedOpts);
      const result = await adapter.showRewarded(plan.unitId);
      return {
        executed: result.earned ? 'rewarded' : 'rewarded_not_earned',
      };
    }
    default: {
      const _exhaustive: never = plan;
      return _exhaustive;
    }
  }
}

export function createMockAdAdapter(): AdAdapter {
  const network: AdNetworkCall[] = [];
  const house: AdSurface[] = [];
  return {
    async loadBanner(unitId) {
      network.push({ kind: 'banner_load', unitId, atMs: Date.now() });
    },
    async showBanner(unitId) {
      network.push({ kind: 'banner_show', unitId, atMs: Date.now() });
    },
    async loadRewarded(unitId) {
      network.push({ kind: 'rewarded_load', unitId, atMs: Date.now() });
    },
    async showRewarded(unitId) {
      network.push({ kind: 'rewarded_show', unitId, atMs: Date.now() });
      return { earned: true };
    },
    async loadInterstitial(unitId) {
      network.push({ kind: 'interstitial_load', unitId, atMs: Date.now() });
    },
    async showInterstitial(unitId) {
      network.push({ kind: 'interstitial_show', unitId, atMs: Date.now() });
      return { impression: true };
    },
    showHouseAd(surface) {
      house.push(surface);
    },
    networkCalls: () => [...network],
  };
}
