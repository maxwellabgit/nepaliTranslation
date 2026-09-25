/* eslint-disable import/first */
jest.mock('../adConfig', () => ({
  resolveAdUnitConfig: jest.fn(() => ({
    env: 'test-ssv', testDeviceIdentifiers: ['2077ef9a63d2b398840261c8221a0c9b'],
  })),
}));
jest.mock('react-native-google-mobile-ads', () => {
  const mockConfigure = jest.fn(async () => undefined);
  const mockInitialize = jest.fn(async () => undefined);
  return {
    __esModule: true,
    __test: { configure: mockConfigure, initialize: mockInitialize },
    default: () => ({
      setRequestConfiguration: mockConfigure,
      initialize: mockInitialize,
    }),
    AdsConsent: {
      gatherConsent: jest.fn(async () => ({
        canRequestAds: true,
        privacyOptionsRequirementStatus: 'NOT_REQUIRED',
      })),
      showPrivacyOptionsForm: jest.fn(),
    },
    AdsConsentPrivacyOptionsRequirementStatus: { REQUIRED: 'REQUIRED' },
  };
});

import { createProductionAdService } from '../AdService';

it('enrolls registered devices before initializing owner AdMob units', async () => {
  const native = require('react-native-google-mobile-ads') as {
    __test: { configure: jest.Mock; initialize: jest.Mock };
  };
  const ads = createProductionAdService();
  const observed: boolean[] = [];
  const unsubscribe = ads.subscribeConsent((state) => {
    observed.push(state.canRequestAds);
    expect(native.__test.initialize).toHaveBeenCalled();
  });
  expect(await ads.prepareConsentAndSdk()).toEqual({
    canRequestAds: true, privacyOptionsRequired: false,
  });
  expect(observed).toEqual([true]);
  unsubscribe();
  expect(native.__test.configure).toHaveBeenCalledWith({
    testDeviceIdentifiers: ['2077ef9a63d2b398840261c8221a0c9b'],
  });
  expect(native.__test.configure.mock.invocationCallOrder[0]).toBeLessThan(
    native.__test.initialize.mock.invocationCallOrder[0],
  );
});

it('publishes consent granted through Privacy options after the first render', async () => {
  const native = require('react-native-google-mobile-ads') as {
    AdsConsent: { showPrivacyOptionsForm: jest.Mock };
    __test: { configure: jest.Mock; initialize: jest.Mock };
  };
  native.__test.configure.mockClear();
  native.__test.initialize.mockClear();
  native.AdsConsent.showPrivacyOptionsForm.mockResolvedValueOnce({
    canRequestAds: true,
    privacyOptionsRequirementStatus: 'REQUIRED',
  });

  const ads = createProductionAdService();
  const observed: boolean[] = [];
  ads.subscribeConsent((state) => observed.push(state.canRequestAds));
  await ads.showPrivacyOptions();

  expect(native.__test.configure).toHaveBeenCalledWith({
    testDeviceIdentifiers: ['2077ef9a63d2b398840261c8221a0c9b'],
  });
  expect(native.__test.initialize).toHaveBeenCalledTimes(1);
  expect(observed).toEqual([true]);
  expect(ads.getConsentState().privacyOptionsRequired).toBe(true);
});
