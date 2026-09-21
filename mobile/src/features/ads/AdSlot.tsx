import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme';
import { useServices } from '../../services/ServiceContext';
import { resolveAdUnitConfig } from './adConfig';
import {
  executeAdPlan,
  planAdPlacement,
  type AdAdapter,
} from './adMiddleware';
import { HouseAd } from './HouseAd';
import type { AdSurface } from '../entitlements/decideAdPresentation';
import { useEntitlementOptional } from '../entitlements/EntitlementProvider';
import { useFeatureFlags } from '../../app/FeatureConfigProvider';

type Props = {
  surface: AdSurface;
  offline?: boolean;
  hasSubscription?: boolean;
  keyboardVisible?: boolean;
  modalVisible?: boolean;
  listening?: boolean;
  speaking?: boolean;
  translating?: boolean;
  appActive?: boolean;
  canRequestAds?: boolean;
  lastNetworkBannerAtMs?: number | null;
  lastHouseBannerAtMs?: number | null;
  onShown?: (kind: 'banner' | 'house') => void;
  onDismissHouse?: () => void;
  adapter?: AdAdapter;
  /** When false, skip planning (e.g. no completed translate yet). */
  eligible?: boolean;
};

/**
 * Soft-fail ad slot. Missing SDK / flag off / offline / entitlement → house or none.
 * Never required for translate / Learn. networkAdsEnabled stays false until human gate.
 */
export function AdSlot({
  surface,
  offline: offlineProp,
  hasSubscription = false,
  keyboardVisible = false,
  modalVisible = false,
  listening = false,
  speaking = false,
  translating = false,
  appActive = true,
  canRequestAds: canRequestAdsProp,
  lastNetworkBannerAtMs = null,
  lastHouseBannerAtMs = null,
  onShown,
  onDismissHouse,
  adapter: injected,
  eligible = true,
}: Props) {
  const services = useServices();
  const entitlement = useEntitlementOptional();
  const flags = useFeatureFlags();
  const [label, setLabel] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const offline = offlineProp ?? services.network.isOffline();
  const canRequestAds =
    canRequestAdsProp ?? services.ads.getConsentState().canRequestAds;
  const adapter = injected ?? services.ads.adapter;
  const earnedAdFreeUntilMs = entitlement?.earnedAdFreeUntilMs ?? null;
  const trustedNowMs = entitlement?.trustedNow() ?? null;

  const units = useMemo(() => {
    try {
      return resolveAdUnitConfig();
    } catch {
      // Soft-fail: invalid production/test ID mix → no network ads.
      return null;
    }
  }, []);

  useEffect(() => {
    if (!eligible || dismissed || !units) {
      setLabel(null);
      return;
    }
    if (entitlement?.hasActiveEarnedAdFree?.()) {
      setLabel('none:earned_ad_free');
      return;
    }
    let cancelled = false;
    void (async () => {
      const plan = planAdPlacement({
        surface,
        networkAdsEnabled: flags.networkAdsEnabled,
        hasSubscription,
        earnedAdFreeUntilMs,
        trustedNowMs,
        offline,
        canRequestAds,
        appActive,
        modalVisible,
        keyboardVisible,
        listening,
        speaking,
        translating,
        lastNetworkBannerAtMs,
        lastHouseBannerAtMs,
        nowMs: Date.now(),
        bannerUnitId: units.bannerUnitId,
      });
      const result = await executeAdPlan(plan, adapter);
      if (cancelled) return;
      setLabel(result.executed);
      if (result.executed === 'house') onShown?.('house');
      if (result.executed === 'banner') onShown?.('banner');
    })();
    return () => {
      cancelled = true;
    };
  }, [
    adapter,
    appActive,
    canRequestAds,
    dismissed,
    earnedAdFreeUntilMs,
    eligible,
    entitlement,
    flags.networkAdsEnabled,
    hasSubscription,
    keyboardVisible,
    lastHouseBannerAtMs,
    lastNetworkBannerAtMs,
    listening,
    modalVisible,
    offline,
    onShown,
    speaking,
    surface,
    translating,
    trustedNowMs,
    units,
  ]);

  if (!label || label.startsWith('none:') || dismissed) return null;
  if (label === 'house') {
    return (
      <HouseAd
        surface={surface}
        onNotNow={() => {
          setDismissed(true);
          onDismissHouse?.();
        }}
      />
    );
  }
  if (label === 'banner') {
    return (
      <View style={styles.banner} testID={`ad-slot-banner-${surface}`}>
        <NativeOrPlaceholderBanner unitId={units?.bannerUnitId ?? ''} />
      </View>
    );
  }
  return null;
}

function NativeOrPlaceholderBanner({ unitId }: { unitId: string }) {
  let Banner: ComponentType<{ unitId: string; size: string }> | null = null;
  let size = 'ANCHORED_ADAPTIVE_BANNER';
  try {
    const ads = require('react-native-google-mobile-ads') as {
      BannerAd: ComponentType<{ unitId: string; size: string }>;
      BannerAdSize: { ANCHORED_ADAPTIVE_BANNER: string };
    };
    Banner = ads.BannerAd;
    size = ads.BannerAdSize.ANCHORED_ADAPTIVE_BANNER;
  } catch {
    Banner = null;
  }
  if (!Banner) {
    return <Text style={styles.bannerText}>Ad</Text>;
  }
  return <Banner unitId={unitId} size={size} />;
}

const styles = StyleSheet.create({
  banner: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    paddingVertical: 4,
  },
  bannerText: { color: colors.textSecondary, fontSize: 12, padding: 10 },
});
