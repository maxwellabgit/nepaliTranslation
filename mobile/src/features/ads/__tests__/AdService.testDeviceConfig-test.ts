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
  expect(await ads.prepareConsentAndSdk()).toEqual({
    canRequestAds: true, privacyOptionsRequired: false,
  });
  expect(native.__test.configure).toHaveBeenCalledWith({
    testDeviceIdentifiers: ['2077ef9a63d2b398840261c8221a0c9b'],
  });
  expect(native.__test.configure.mock.invocationCallOrder[0]).toBeLessThan(
    native.__test.initialize.mock.invocationCallOrder[0],
  );
});
