import {
  GOOGLE_TEST_BANNER_UNIT,
  GOOGLE_TEST_REWARDED_UNIT,
  GOOGLE_TEST_INTERSTITIAL_UNIT,
  GOOGLE_TEST_APP_ID_IOS,
  GOOGLE_TEST_APP_ID_ANDROID,
  resolveAdUnitConfig,
  validateAdUnitConfig,
} from '../adConfig';

describe('adConfig', () => {
  it('accepts Google test IDs outside production', () => {
    expect(() =>
      validateAdUnitConfig({
        env: 'test',
        iosAppId: GOOGLE_TEST_APP_ID_IOS,
        androidAppId: GOOGLE_TEST_APP_ID_ANDROID,
        bannerUnitId: GOOGLE_TEST_BANNER_UNIT,
        rewardedUnitId: GOOGLE_TEST_REWARDED_UNIT,
        interstitialUnitId: GOOGLE_TEST_INTERSTITIAL_UNIT,
      }),
    ).not.toThrow();
  });

  it('production rejects test IDs', () => {
    expect(() =>
      validateAdUnitConfig({
        env: 'production',
        iosAppId: GOOGLE_TEST_APP_ID_IOS,
        androidAppId: GOOGLE_TEST_APP_ID_ANDROID,
        bannerUnitId: GOOGLE_TEST_BANNER_UNIT,
        rewardedUnitId: GOOGLE_TEST_REWARDED_UNIT,
        interstitialUnitId: GOOGLE_TEST_INTERSTITIAL_UNIT,
      }),
    ).toThrow(/rejects Google test/);
  });

  it('non-production rejects production IDs', () => {
    expect(() =>
      validateAdUnitConfig({
        env: 'test',
        iosAppId: 'ca-app-pub-1234567890123456~1234567890',
        androidAppId: 'ca-app-pub-1234567890123456~0987654321',
        bannerUnitId: 'ca-app-pub-1234567890123456/1111111111',
        rewardedUnitId: 'ca-app-pub-1234567890123456/2222222222',
        interstitialUnitId: 'ca-app-pub-1234567890123456/3333333333',
      }),
    ).toThrow(/rejects production/);
  });

  it('resolveAdUnitConfig defaults to test IDs in Jest', () => {
    const cfg = resolveAdUnitConfig({ env: 'test' });
    expect(cfg.bannerUnitId).toBe(GOOGLE_TEST_BANNER_UNIT);
    expect(cfg.interstitialUnitId).toBe(GOOGLE_TEST_INTERSTITIAL_UNIT);
    expect(cfg.env).toBe('test');
  });

  it('requires an enrolled physical test device for owner-owned SSV ad units', () => {
    const own = {
      env: 'test-ssv' as const,
      iosAppId: 'ca-app-pub-1234567890123456~1234567890',
      androidAppId: GOOGLE_TEST_APP_ID_ANDROID,
      bannerUnitId: 'ca-app-pub-1234567890123456/1111111111',
      rewardedUnitId: 'ca-app-pub-1234567890123456/2222222222',
      interstitialUnitId: 'ca-app-pub-1234567890123456/3333333333',
    };
    expect(() => validateAdUnitConfig(own)).toThrow(/test device/i);
    expect(() => validateAdUnitConfig({
      ...own, testDeviceIdentifiers: ['2077ef9a63d2b398840261c8221a0c9b'],
    })).not.toThrow();
    expect(() => validateAdUnitConfig({
      ...own,
      rewardedUnitId: GOOGLE_TEST_REWARDED_UNIT,
      testDeviceIdentifiers: ['2077ef9a63d2b398840261c8221a0c9b'],
    })).toThrow(/demo IDs/);
  });
});
