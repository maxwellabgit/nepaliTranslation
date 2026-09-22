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

/**
 * R0 ads-env authority.
 *
 * `EXPO_PUBLIC_ADS_ENV` is authoritative. `test` forces Google's official
 * test unit IDs even when store distribution is on (needed for TestFlight
 * internal builds). `live` requires production IDs and refuses test IDs.
 *
 * A `production` EAS profile alone MUST NOT imply live ads: the caller
 * must set `EXPO_PUBLIC_ADS_ENV=live` explicitly. This eliminates the
 * `npx testflight` shortcut hazard called out in the audit.
 */
function readAdsEnv() {
  const raw = process.env.EXPO_PUBLIC_ADS_ENV;
  if (raw === 'test' || raw === 'live') return raw;
  if (raw && raw.length > 0) {
    throw new Error(
      `EXPO_PUBLIC_ADS_ENV must be "test" or "live" (got "${raw}")`,
    );
  }
  return 'test';
}

function isLiveAdsEnv() {
  return readAdsEnv() === 'live';
}

module.exports = ({ config }) => {
  const production = isLiveAdsEnv();
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
        env: production ? 'live' : 'test',
        iosAppId,
        androidAppId,
        bannerUnitId,
        rewardedUnitId,
        interstitialUnitId,
      },
      revenueCatAppleApiKey:
        process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY || '',
      // R0 build-provenance surface. Read by `readBuildProvenance()` at
      // runtime for the Settings → About diagnostic card. Contains no
      // secret material — just SHA and channel labels.
      gitSha:
        process.env.EXPO_PUBLIC_GIT_SHA ||
        process.env.EAS_BUILD_GIT_COMMIT_HASH ||
        '',
      releaseChannel:
        process.env.EXPO_PUBLIC_RELEASE_CHANNEL ||
        process.env.EAS_BUILD_PROFILE ||
        'unknown',
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
