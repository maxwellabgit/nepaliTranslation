/**
 * Expo config with env-specific AdMob app IDs.
 * Non-production always defaults to Google test app IDs.
 * Production requires real IDs via EXPO_PUBLIC_ADMOB_* (never test IDs).
 */

/** Google sample app IDs — mandatory outside production. */
const TEST_IOS_APP_ID = 'ca-app-pub-3940256099942544~1458002511';
const TEST_ANDROID_APP_ID = 'ca-app-pub-3940256099942544~3347511713';
const TEST_BANNER_UNIT = 'ca-app-pub-3940256099942544/2934735716';
const TEST_REWARDED_UNIT = 'ca-app-pub-3940256099942544/1712485313';
const TEST_INTERSTITIAL_UNIT = 'ca-app-pub-3940256099942544/4411468910';

function isProductionAdsEnv() {
  if (process.env.EXPO_PUBLIC_ADS_ENV === 'production') return true;
  if (process.env.EAS_BUILD_PROFILE === 'production') return true;
  return false;
}

function looksLikeTestId(id) {
  return typeof id === 'string' && id.includes('3940256099942544');
}

function resolveAppIds(production) {
  if (!production) {
    return {
      iosAppId: process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID || TEST_IOS_APP_ID,
      androidAppId:
        process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID || TEST_ANDROID_APP_ID,
    };
  }
  const iosAppId = process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID || '';
  const androidAppId = process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID || '';
  if (!iosAppId || !androidAppId) {
    throw new Error(
      'Production AdMob requires EXPO_PUBLIC_ADMOB_IOS_APP_ID and EXPO_PUBLIC_ADMOB_ANDROID_APP_ID',
    );
  }
  if (looksLikeTestId(iosAppId) || looksLikeTestId(androidAppId)) {
    throw new Error('Production AdMob rejects Google test app IDs');
  }
  return { iosAppId, androidAppId };
}

module.exports = ({ config }) => {
  const production = isProductionAdsEnv();
  const { iosAppId, androidAppId } = resolveAppIds(production);

  const bannerUnitId = production
    ? process.env.EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID || ''
    : process.env.EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID || TEST_BANNER_UNIT;
  const rewardedUnitId = production
    ? process.env.EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID || ''
    : process.env.EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID || TEST_REWARDED_UNIT;
  const interstitialUnitId = production
    ? process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID || ''
    : process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID ||
      TEST_INTERSTITIAL_UNIT;

  if (production) {
    if (!bannerUnitId || !rewardedUnitId || !interstitialUnitId) {
      throw new Error(
        'Production AdMob requires EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID, EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID, and EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID',
      );
    }
    if (
      looksLikeTestId(bannerUnitId) ||
      looksLikeTestId(rewardedUnitId) ||
      looksLikeTestId(interstitialUnitId)
    ) {
      throw new Error('Production AdMob rejects Google test unit IDs');
    }
  }

  const plugins = (config.plugins || []).filter(
    (p) =>
      p !== 'react-native-google-mobile-ads' &&
      !(Array.isArray(p) && p[0] === 'react-native-google-mobile-ads'),
  );
  plugins.push([
    'react-native-google-mobile-ads',
    {
      androidAppId,
      iosAppId,
    },
  ]);

  return {
    ...config,
    plugins,
    extra: {
      ...config.extra,
      ads: {
        env: production ? 'production' : 'test',
        iosAppId,
        androidAppId,
        bannerUnitId,
        rewardedUnitId,
        interstitialUnitId,
      },
      revenueCatAppleApiKey:
        process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY || '',
      legal: {
        privacyPolicyUrl: process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL || '',
        termsOfServiceUrl: process.env.EXPO_PUBLIC_TERMS_OF_SERVICE_URL || '',
        supportUrl: process.env.EXPO_PUBLIC_SUPPORT_URL || '',
        deletionInfoUrl: process.env.EXPO_PUBLIC_DELETION_INFO_URL || '',
        appAdsTxtUrl: process.env.EXPO_PUBLIC_APP_ADS_TXT_URL || '',
      },
    },
  };
};
