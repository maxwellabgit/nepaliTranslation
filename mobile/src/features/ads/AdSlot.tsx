import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View } from 'react-native';

import { colors } from '../../theme';
import { useServices } from '../../services/ServiceContext';
import { resolveAdUnitConfig } from './adConfig';
import {
  executeAdPlan,
  planAdPlacement,
  type AdAdapter,
} from './adMiddleware';
import {
  loadBannerCooldowns,
  recordBannerShown,
} from './bannerCooldown';
import { HouseAd } from './HouseAd';
import type { AdSurface } from '../entitlements/decideAdPresentation';
import { useEntitlementOptional } from '../entitlements/EntitlementProvider';
import { useFeatureFlags } from '../../app/FeatureConfigProvider';
import { NativeOrPlaceholderBanner } from './NativeBanner';

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
  /** Optional override; when omitted, AdSlot loads/persists shared cooldowns. */
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
 * Enforces 12m network / 24m house cooldowns via persisted timestamps.
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
  lastNetworkBannerAtMs: lastNetworkProp,
  lastHouseBannerAtMs: lastHouseProp,
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
  const [storedNetworkAt, setStoredNetworkAt] = useState<number | null>(null);
  const [storedHouseAt, setStoredHouseAt] = useState<number | null>(null);
  const [cooldownsReady, setCooldownsReady] = useState(
    lastNetworkProp !== undefined && lastHouseProp !== undefined,
  );
  /** Keeps the current impression visible when recording cooldown would re-plan to none. */
  const shownKindRef = useRef<'banner' | 'house' | null>(null);

  const offline = offlineProp ?? services.network.isOffline();
  const canRequestAds =
    canRequestAdsProp ?? services.ads.getConsentState().canRequestAds;
  const adapter = injected ?? services.ads.adapter;
  const earnedAdFreeUntilMs = entitlement?.earnedAdFreeUntilMs ?? null;
  const trustedNowMs = entitlement?.trustedNow() ?? null;

  const lastNetworkBannerAtMs =
    lastNetworkProp !== undefined ? lastNetworkProp : storedNetworkAt;
  const lastHouseBannerAtMs =
    lastHouseProp !== undefined ? lastHouseProp : storedHouseAt;

  const units = useMemo(() => {
    try {
      return resolveAdUnitConfig();
    } catch {
      // Soft-fail: invalid production/test ID mix → no network ads.
      return null;
    }
  }, []);

  useEffect(() => {
    if (lastNetworkProp !== undefined && lastHouseProp !== undefined) {
      setCooldownsReady(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      const loaded = await loadBannerCooldowns();
      if (cancelled) return;
      setStoredNetworkAt(loaded.lastNetworkBannerAtMs);
      setStoredHouseAt(loaded.lastHouseBannerAtMs);
      setCooldownsReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [lastHouseProp, lastNetworkProp]);

  useEffect(() => {
    if (!eligible || dismissed || !units || !cooldownsReady) {
      shownKindRef.current = null;
      setLabel(null);
      return;
    }
    if (entitlement?.hasActiveEarnedAdFree?.()) {
      shownKindRef.current = null;
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
      if (result.executed === 'house' || result.executed === 'banner') {
        const kind = result.executed;
        shownKindRef.current = kind;
        setLabel(kind);
        if (lastNetworkProp === undefined || lastHouseProp === undefined) {
          const next = await recordBannerShown(kind);
          if (!cancelled) {
            setStoredNetworkAt(next.lastNetworkBannerAtMs);
            setStoredHouseAt(next.lastHouseBannerAtMs);
          }
        }
        onShown?.(kind);
        return;
      }
      // After we record a show, re-plan hits cooldown — keep the impression up.
      if (
        (result.executed === 'none:banner_cooldown' ||
          result.executed === 'none:house_cooldown') &&
        shownKindRef.current
      ) {
        setLabel(shownKindRef.current);
        return;
      }
      shownKindRef.current = null;
      setLabel(result.executed);
    })();
    return () => {
      cancelled = true;
    };
  }, [
    adapter,
    appActive,
    canRequestAds,
    cooldownsReady,
    dismissed,
    earnedAdFreeUntilMs,
    eligible,
    entitlement,
    flags.networkAdsEnabled,
    hasSubscription,
    keyboardVisible,
    lastHouseBannerAtMs,
    lastHouseProp,
    lastNetworkBannerAtMs,
    lastNetworkProp,
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

const styles = StyleSheet.create({
  banner: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    paddingVertical: 4,
  },
});
