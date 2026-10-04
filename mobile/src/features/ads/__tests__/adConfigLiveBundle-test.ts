import Constants from 'expo-constants';
import { resolveAdUnitConfig, GOOGLE_TEST_APP_ID_ANDROID, GOOGLE_TEST_REWARDED_UNIT } from '../adConfig';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { ads: null } } },
}));

it('accepts the actual emitted live iOS bundle without an owned Android app', () => {
  const configure = jest.requireActual('../../../../app.config.js');
  const values: Record<string, string> = {
    EXPO_PUBLIC_ADS_ENV: 'live',
    EXPO_PUBLIC_ADMOB_IOS_APP_ID: 'ca-app-pub-4740685179017246~9596916235',
    EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID: 'ca-app-pub-4740685179017246/5830819203',
    EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID: 'ca-app-pub-4740685179017246/7882267470',
    EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID: 'ca-app-pub-4740685179017246/8045919001',
  };
  const names = [...Object.keys(values), 'EXPO_PUBLIC_ADMOB_ANDROID_APP_ID'];
  const before = Object.fromEntries(names.map(name=>[name,process.env[name]]));
  try {
    Object.assign(process.env, values);
    delete process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID;
    const emitted=configure({config:{plugins:[]}});
    Constants.expoConfig!.extra!.ads=emitted.extra.ads;
    const config=resolveAdUnitConfig();
    expect(config.env).toBe('production');
    expect(config.androidAppId).toBe(GOOGLE_TEST_APP_ID_ANDROID);
    expect(config.rewardedUnitId).toBe(values.EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID);
    expect(()=>resolveAdUnitConfig({rewardedUnitId:GOOGLE_TEST_REWARDED_UNIT})).toThrow(/rejects Google test/);
  } finally {
    Constants.expoConfig!.extra!.ads=null;
    for(const [name,value] of Object.entries(before)) {
      if(value===undefined)delete process.env[name];else process.env[name]=value;
    }
  }
});
