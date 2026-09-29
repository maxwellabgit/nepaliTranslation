import { StyleSheet, Text, View } from 'react-native';
import type { ComponentType } from 'react';
import { colors } from '../../theme';

const NATIVE_ADS = 'react-native-google-mobile-ads';

function isTestingGround(): boolean {
  if (typeof window === 'undefined') return false;
  const boot = (
    window as unknown as { __NEPTRANSLATE_TG__?: { harness?: string } }
  ).__NEPTRANSLATE_TG__;
  return boot?.harness === 'neptranslate-testing-ground';
}

/** Visible stand-in for Google's demo banner. Not a live impression. */
function TestingGroundSampleBanner() {
  return (
    <View style={styles.sample} testID="sample-ad-banner">
      <Text style={styles.badge}>TEST AD</Text>
      <Text style={styles.sampleTitle}>Banner</Text>
    </View>
  );
}

/**
 * Native banner when the AdMob module is linked. Placeholder otherwise.
 * Size is anchored adaptive, so test builds must use Google's adaptive demo
 * unit (see GOOGLE_TEST_BANNER_UNIT), not the fixed-size banner demo unit.
 */
export function NativeOrPlaceholderBanner({
  unitId,
}: {
  unitId: string;
}) {
  if (isTestingGround()) return <TestingGroundSampleBanner />;
  let Banner: ComponentType<{ unitId: string; size: string }> | null = null;
  let size = 'ANCHORED_ADAPTIVE_BANNER';
  try {
    const ads = require(NATIVE_ADS) as {
      BannerAd: ComponentType<{ unitId: string; size: string }>;
      BannerAdSize: { ANCHORED_ADAPTIVE_BANNER: string };
    };
    Banner = ads.BannerAd;
    size = ads.BannerAdSize.ANCHORED_ADAPTIVE_BANNER;
  } catch {
    Banner = null;
  }
  if (!Banner) {
    if (isTestingGround()) return <TestingGroundSampleBanner />;
    return (
      <Text style={{ color: colors.textSecondary, fontSize: 12, padding: 10 }}>
        Ad
      </Text>
    );
  }
  return <Banner unitId={unitId} size={size} />;
}

const styles = StyleSheet.create({
  sample: {
    width: '100%',
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F1D8',
    paddingVertical: 6,
    gap: 1,
  },
  badge: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: '#6B4A12',
  },
  sampleTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1410',
  },
});
