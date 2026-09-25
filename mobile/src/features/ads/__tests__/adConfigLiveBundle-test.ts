import { resolveAdUnitConfig } from '../adConfig';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: { extra: { ads: {
      env: 'live',
      iosAppId: 'ca-app-pub-1234567890123456~1234567890',
      androidAppId: 'ca-app-pub-1234567890123456~0987654321',
      bannerUnitId: 'ca-app-pub-1234567890123456/1111111111',
      rewardedUnitId: 'ca-app-pub-1234567890123456/2222222222',
      interstitialUnitId: 'ca-app-pub-1234567890123456/3333333333',
    } } },
  },
}));

it('interprets the live app.config bundle as production ad units', () => {
  const config = resolveAdUnitConfig();
  expect(config.env).toBe('production');
  expect(config.rewardedUnitId).toBe('ca-app-pub-1234567890123456/2222222222');
});
