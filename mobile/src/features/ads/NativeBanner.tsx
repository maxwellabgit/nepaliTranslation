import { Text } from 'react-native';
import type { ComponentType } from 'react';
import { colors } from '../../theme';

const NATIVE_ADS = 'react-native-google-mobile-ads';

/** Native banner when the AdMob module is linked. Placeholder otherwise. */
export function NativeOrPlaceholderBanner({ unitId }: { unitId: string }) {
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
    return (
      <Text style={{ color: colors.textSecondary, fontSize: 12, padding: 10 }}>
        Ad
      </Text>
    );
  }
  return <Banner unitId={unitId} size={size} />;
}
