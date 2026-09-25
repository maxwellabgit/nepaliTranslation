const assert = require('node:assert/strict');
const test = require('node:test');
const configure = require('../app.config.js');

test('TestFlight bundles Google test IDs even with shared live-ad environment variables', () => {
  const names = [
    'EXPO_PUBLIC_ADS_ENV',
    'EXPO_PUBLIC_ADMOB_IOS_APP_ID',
    'EXPO_PUBLIC_ADMOB_ANDROID_APP_ID',
    'EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID',
    'EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID',
    'EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID',
    'EXPO_PUBLIC_ADMOB_TEST_DEVICE_IDS',
  ];
  const before = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  try {
    process.env.EXPO_PUBLIC_ADS_ENV = 'test';
    for (const name of names.slice(1)) process.env[name] = 'ca-app-pub-live-unit';
    const result = configure({ config: { plugins: [] } });
    assert.equal(result.extra.ads.env, 'test');
    for (const field of ['iosAppId', 'androidAppId', 'bannerUnitId', 'rewardedUnitId', 'interstitialUnitId']) {
      assert.match(result.extra.ads[field], /^ca-app-pub-3940256099942544[~/]/);
    }
  } finally {
    for (const name of names) {
      if (before[name] === undefined) delete process.env[name];
      else process.env[name] = before[name];
    }
  }
});

test('SSV TestFlight refuses owner units without registered test devices', () => {
  const before = Object.fromEntries([
    'EXPO_PUBLIC_ADS_ENV', 'EXPO_PUBLIC_ADMOB_IOS_APP_ID',
    'EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID', 'EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID',
    'EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID', 'EXPO_PUBLIC_ADMOB_TEST_DEVICE_IDS',
  ].map((name) => [name, process.env[name]]));
  try {
    process.env.EXPO_PUBLIC_ADS_ENV = 'test-ssv';
    process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID = 'ca-app-pub-1234567890123456~1234567890';
    process.env.EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID = 'ca-app-pub-1234567890123456/1111111111';
    process.env.EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID = 'ca-app-pub-1234567890123456/2222222222';
    process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID = 'ca-app-pub-1234567890123456/3333333333';
    delete process.env.EXPO_PUBLIC_ADMOB_TEST_DEVICE_IDS;
    assert.throws(() => configure({ config: { plugins: [] } }), /registered.*test device/i);
    process.env.EXPO_PUBLIC_ADMOB_TEST_DEVICE_IDS = '2077ef9a63d2b398840261c8221a0c9b';
    const app = configure({ config: { plugins: [] } });
    assert.equal(app.extra.ads.env, 'test-ssv');
    assert.equal(app.extra.ads.testDeviceIdentifiers.length, 1);
    assert.equal(app.extra.ads.rewardedUnitId, process.env.EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID);
  } finally {
    for (const [name, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
