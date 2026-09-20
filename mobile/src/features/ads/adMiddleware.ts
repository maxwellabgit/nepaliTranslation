import {
  decideAdPresentation,
  type AdDecision,
  type AdSurface,
} from '../entitlements/decideAdPresentation';

export type AdNetworkCall = {
  kind: 'banner_load' | 'banner_show' | 'rewarded_load' | 'rewarded_show';
  unitId: string;
  atMs: number;
};

/**
 * Narrow adapter surface. Real AdMob (react-native-google-mobile-ads) plugs in
 * behind this in a dev build; tests and Expo Go use the mock.
 */
export type AdAdapter = {
  loadBanner: (unitId: string) => Promise<void>;
  showBanner: (unitId: string) => Promise<void>;
  loadRewarded: (unitId: string) => Promise<void>;
  showRewarded: (unitId: string) => Promise<void>;
  showHouseAd: (surface: AdSurface) => void;
  /** Test/observability: network-bound AdMob invocations only. */
  networkCalls: () => AdNetworkCall[];
};

export type AdPlan =
  | { action: 'none'; reason: string }
  | { action: 'house'; surface: AdSurface }
  | { action: 'banner'; unitId: string }
  | { action: 'blocked_offline_network' };

export function planAdPlacement(input: {
  surface: AdSurface;
  networkAdsEnabled: boolean;
  hasSubscription: boolean;
  earnedAdFreeUntilMs: number | null;
  trustedNowMs: number | null;
  offline: boolean;
  bannerUnitId: string;
}): AdPlan {
  const decision: AdDecision = decideAdPresentation({
    surface: input.surface,
    networkAdsEnabled: input.networkAdsEnabled,
    hasSubscription: input.hasSubscription,
    earnedAdFreeUntilMs: input.earnedAdFreeUntilMs,
    trustedNowMs: input.trustedNowMs,
    offline: input.offline,
  });
  if (!decision.show) {
    return { action: 'none', reason: decision.reason };
  }
  if (decision.kind === 'house') {
    return { action: 'house', surface: input.surface };
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
    },
    showHouseAd(surface) {
      house.push(surface);
    },
    networkCalls: () => [...network],
  };
}

/** Pure SSV payload checks (fixtures). Secrets stay server-side. */
export function verifyAdmobSsvShape(payload: Record<string, unknown>): {
  ok: boolean;
  reason?: string;
} {
  const required = ['ad_network', 'ad_unit', 'reward_amount', 'reward_item', 'timestamp', 'transaction_id', 'user_id', 'signature', 'key_id'];
  for (const key of required) {
    if (payload[key] == null || payload[key] === '') {
      return { ok: false, reason: `missing_${key}` };
    }
  }
  if (typeof payload.timestamp !== 'string' && typeof payload.timestamp !== 'number') {
    return { ok: false, reason: 'bad_timestamp' };
  }
  return { ok: true };
}
