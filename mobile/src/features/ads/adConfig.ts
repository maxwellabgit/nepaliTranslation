import Constants from 'expo-constants';

/** Google sample IDs — required outside production; forbidden in production. */
export const GOOGLE_TEST_APP_ID_IOS = 'ca-app-pub-3940256099942544~1458002511';
export const GOOGLE_TEST_APP_ID_ANDROID =
  'ca-app-pub-3940256099942544~3347511713';
export const GOOGLE_TEST_BANNER_UNIT = 'ca-app-pub-3940256099942544/2934735716';
export const GOOGLE_TEST_REWARDED_UNIT =
  'ca-app-pub-3940256099942544/1712485313';
export const GOOGLE_TEST_INTERSTITIAL_UNIT =
  'ca-app-pub-3940256099942544/4411468910';

export type AdsRuntimeEnv = 'production' | 'test';

export type AdUnitConfig = {
  env: AdsRuntimeEnv;
  iosAppId: string;
  androidAppId: string;
  bannerUnitId: string;
  rewardedUnitId: string;
  interstitialUnitId: string;
};

export function isGoogleTestAdId(id: string): boolean {
  return id.includes('3940256099942544');
}

/**
 * Resolve and validate AdMob IDs for the current build.
 * Production builds reject test IDs; non-production rejects production IDs
 * when EXPO_PUBLIC_ADS_ENV is explicitly `test` (default outside production).
 */
export function resolveAdUnitConfig(
  input?: Partial<AdUnitConfig> & { env?: AdsRuntimeEnv },
): AdUnitConfig {
  const extra = (Constants.expoConfig?.extra as { ads?: Partial<AdUnitConfig> } | undefined)
    ?.ads;
  const env: AdsRuntimeEnv =
    input?.env ??
    (extra?.env === 'production' ? 'production' : 'test');

  const config: AdUnitConfig = {
    env,
    iosAppId:
      input?.iosAppId ??
      extra?.iosAppId ??
      (env === 'production' ? '' : GOOGLE_TEST_APP_ID_IOS),
    androidAppId:
      input?.androidAppId ??
      extra?.androidAppId ??
      (env === 'production' ? '' : GOOGLE_TEST_APP_ID_ANDROID),
    bannerUnitId:
      input?.bannerUnitId ??
      extra?.bannerUnitId ??
      (env === 'production' ? '' : GOOGLE_TEST_BANNER_UNIT),
    rewardedUnitId:
      input?.rewardedUnitId ??
      extra?.rewardedUnitId ??
      (env === 'production' ? '' : GOOGLE_TEST_REWARDED_UNIT),
    interstitialUnitId:
      input?.interstitialUnitId ??
      extra?.interstitialUnitId ??
      (env === 'production' ? '' : GOOGLE_TEST_INTERSTITIAL_UNIT),
  };

  validateAdUnitConfig(config);
  return config;
}

export function validateAdUnitConfig(config: AdUnitConfig): void {
  const ids = [
    config.iosAppId,
    config.androidAppId,
    config.bannerUnitId,
    config.rewardedUnitId,
    config.interstitialUnitId,
  ];
  if (ids.some((id) => !id || typeof id !== 'string')) {
    throw new Error('AdMob config missing required app or unit ID');
  }
  if (config.env === 'production') {
    for (const id of ids) {
      if (isGoogleTestAdId(id)) {
        throw new Error('Production AdMob config rejects Google test IDs');
      }
    }
    return;
  }
  for (const id of ids) {
    if (!isGoogleTestAdId(id)) {
      throw new Error('Non-production AdMob config rejects production IDs');
    }
  }
}

export const HOUSE_BANNER_COOLDOWN_MS = 24 * 60 * 1000;
export const NETWORK_BANNER_COOLDOWN_MS = 12 * 60 * 1000;
export const PROVISIONAL_AD_FREE_MS = 10 * 60 * 1000;
export const PROVISIONAL_EXPIRE_MS = 15 * 60 * 1000;

/** English fallbacks; UI prefers `t('ads.*')` via HouseAd / RewardedAdButton. */
export const HOUSE_AD_COPY = 'Prefer no ads? Ad-free is $0.99/month.';
export const HOUSE_AD_DISMISS = 'Not now';
export const REWARDED_CTA_LABEL =
  'Watch one optional ad for 15 ad-free minutes';
