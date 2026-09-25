/**
 * Expo config with env-specific AdMob app IDs.
 * Internal TestFlight uses Google demo IDs by default. A separate SSV test
 * profile uses owner-owned iOS IDs on registered test devices.
 * Production requires real IDs via EXPO_PUBLIC_ADMOB_*.
 */

/** Google sample IDs for the ordinary internal TestFlight build. */
const TEST_IOS_APP_ID = 'ca-app-pub-3940256099942544~1458002511';
const TEST_ANDROID_APP_ID = 'ca-app-pub-3940256099942544~3347511713';
const TEST_BANNER_UNIT = 'ca-app-pub-3940256099942544/2934735716';
const TEST_REWARDED_UNIT = 'ca-app-pub-3940256099942544/1712485313';
const TEST_INTERSTITIAL_UNIT = 'ca-app-pub-3940256099942544/4411468910';

function looksLikeTestId(id) {
  return typeof id === 'string' && id.includes('3940256099942544');
}

function resolveAppIds(production, ssvTest) {
  if (!production && !ssvTest) {
    return {
      iosAppId: TEST_IOS_APP_ID,
      androidAppId: TEST_ANDROID_APP_ID,
    };
  }
  const iosAppId = process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID || '';
  const androidAppId = ssvTest
    ? TEST_ANDROID_APP_ID
    : process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID || '';
  if (!iosAppId || !androidAppId) {
    throw new Error(
      'Owned AdMob app ID(s) required for live or TestFlight SSV ads',
    );
  }
  if (looksLikeTestId(iosAppId) || (!ssvTest && looksLikeTestId(androidAppId))) {
    throw new Error('Owned AdMob app IDs reject Google demo IDs');
  }
  return { iosAppId, androidAppId };
}

/**
 * R0 ads-env authority.
 *
 * `EXPO_PUBLIC_ADS_ENV` is authoritative. `test` forces Google's official
 * test unit IDs even when store distribution is on (needed for TestFlight
 * internal builds). `test-ssv` requires owner-owned iOS units and registered
 * test device IDs so signed server-side reward callbacks can be exercised.
 * `live` requires production IDs and refuses demo IDs.
 *
 * A `production` EAS profile alone MUST NOT imply live ads: the caller
 * must set `EXPO_PUBLIC_ADS_ENV=live` explicitly. This eliminates the
 * `npx testflight` shortcut hazard called out in the audit.
 */
function readAdsEnv() {
  const raw = process.env.EXPO_PUBLIC_ADS_ENV;
  if (raw === 'test' || raw === 'test-ssv' || raw === 'live') return raw;
  if (raw && raw.length > 0) {
    throw new Error(
      `EXPO_PUBLIC_ADS_ENV must be "test", "test-ssv", or "live" (got "${raw}")`,
    );
  }
  return 'test';
}

function isLiveAdsEnv() {
  return readAdsEnv() === 'live';
}

module.exports = ({ config }) => {
  const production = isLiveAdsEnv();
  const ssvTest = readAdsEnv() === 'test-ssv';
  const { iosAppId, androidAppId } = resolveAppIds(production, ssvTest);

  const bannerUnitId = production || ssvTest
    ? process.env.EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID || ''
    : TEST_BANNER_UNIT;
  const rewardedUnitId = production || ssvTest
    ? process.env.EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID || ''
    : TEST_REWARDED_UNIT;
  const interstitialUnitId = production || ssvTest
    ? process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID || ''
    : TEST_INTERSTITIAL_UNIT;

  if (production || ssvTest) {
    if (!bannerUnitId || !rewardedUnitId || !interstitialUnitId) {
      throw new Error(
        'Live or TestFlight SSV AdMob requires banner, rewarded, and interstitial unit IDs',
      );
    }
    if (
      looksLikeTestId(bannerUnitId) ||
      looksLikeTestId(rewardedUnitId) ||
      looksLikeTestId(interstitialUnitId)
    ) {
      throw new Error('Owner AdMob units reject Google demo unit IDs');
    }
  }

  // Own ad units can exercise the SSV callback on enrolled physical test
  // devices. Refuse a TestFlight SSV build without explicit device IDs.
  const testDeviceIdentifiers = ssvTest
    ? (process.env.EXPO_PUBLIC_ADMOB_TEST_DEVICE_IDS || '')
        .split(',').map((id) => id.trim()).filter(Boolean)
    : [];
  if (ssvTest && (
    testDeviceIdentifiers.length === 0 ||
    testDeviceIdentifiers.some((id) => !/^[0-9a-f]{32}$/i.test(id))
  )) {
    throw new Error('TestFlight SSV requires registered 32-character AdMob test device IDs');
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
        env: production ? 'live' : ssvTest ? 'test-ssv' : 'test',
        iosAppId,
        androidAppId,
        bannerUnitId,
        rewardedUnitId,
        interstitialUnitId,
        testDeviceIdentifiers,
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
