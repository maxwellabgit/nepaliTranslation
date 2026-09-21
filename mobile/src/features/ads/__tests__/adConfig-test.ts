import {
  GOOGLE_TEST_BANNER_UNIT,
  GOOGLE_TEST_REWARDED_UNIT,
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
      }),
    ).toThrow(/rejects production/);
  });

  it('resolveAdUnitConfig defaults to test IDs in Jest', () => {
    const cfg = resolveAdUnitConfig({ env: 'test' });
    expect(cfg.bannerUnitId).toBe(GOOGLE_TEST_BANNER_UNIT);
    expect(cfg.env).toBe('test');
  });
});
