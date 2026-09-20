import { Text, View, StyleSheet } from 'react-native';
import { useEffect, useMemo, useState } from 'react';

import { colors } from '../../theme';
import {
  createMockAdAdapter,
  executeAdPlan,
  planAdPlacement,
  type AdAdapter,
} from './adMiddleware';
import type { AdSurface } from '../entitlements/decideAdPresentation';

type Props = {
  surface: AdSurface;
  offline?: boolean;
  networkAdsEnabled?: boolean;
  hasSubscription?: boolean;
  earnedAdFreeUntilMs?: number | null;
  trustedNowMs?: number | null;
  bannerUnitId?: string;
  adapter?: AdAdapter;
};

/**
 * Soft-fail ad slot. Missing SDK / flag off / offline / entitlement → house or none.
 * Never required for translate / Learn. Default networkAdsEnabled is false until
 * AdMob unit IDs and a native build are configured (human gate).
 */
export function AdSlot({
  surface,
  offline = false,
  networkAdsEnabled = false,
  hasSubscription = false,
  earnedAdFreeUntilMs = null,
  trustedNowMs = null,
  bannerUnitId = 'ca-app-pub-test/banner',
  adapter: injected,
}: Props) {
  const [label, setLabel] = useState<string | null>(null);
  const fallbackAdapter = useMemo(() => createMockAdAdapter(), []);
  const adapter = injected ?? fallbackAdapter;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const plan = planAdPlacement({
        surface,
        networkAdsEnabled,
        hasSubscription,
        earnedAdFreeUntilMs,
        trustedNowMs,
        offline,
        bannerUnitId,
      });
      const result = await executeAdPlan(plan, adapter);
      if (!cancelled) setLabel(result.executed);
    })();
    return () => {
      cancelled = true;
    };
  }, [
    adapter,
    bannerUnitId,
    earnedAdFreeUntilMs,
    hasSubscription,
    networkAdsEnabled,
    offline,
    surface,
    trustedNowMs,
  ]);

  if (!label || label.startsWith('none:')) return null;
  if (label === 'house') {
    return (
      <View style={styles.house} testID={`ad-slot-house-${surface}`}>
        <Text style={styles.houseText}>NepTranslate</Text>
        <Text style={styles.houseHint}>Offline house ad</Text>
      </View>
    );
  }
  return (
    <View style={styles.banner} testID={`ad-slot-banner-${surface}`}>
      <Text style={styles.bannerText}>Ad placeholder</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  house: {
    padding: 12,
    backgroundColor: colors.pasteBg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    alignItems: 'center',
  },
  houseText: { fontWeight: '800', color: colors.crimson },
  houseHint: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  banner: {
    padding: 10,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    alignItems: 'center',
  },
  bannerText: { color: colors.textSecondary, fontSize: 12 },
});
