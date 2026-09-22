// @ts-nocheck
/**
 * R5 timeout coverage: verify AdService's bounded-timeout paths.
 *
 * Uses fake timers so 20-second load timeout / 60-second show timeout
 * fire deterministically. Reuses the same plain-JS jest.mock factory
 * shape as AdService.voidLoadContract-test.ts (babel-plugin-jest-hoist
 * requires no out-of-scope identifiers in the factory).
 */
/* eslint-disable import/first */
jest.mock('react-native-google-mobile-ads', () => {
  function mockMakeAd() {
    const ad = {
      listeners: new Map(),
      load: jest.fn(() => undefined),
      show: jest.fn(() => undefined),
      addAdEventListener(event, cb) {
        let set = ad.listeners.get(event);
        if (!set) {
          set = new Set();
          ad.listeners.set(event, set);
        }
        set.add(cb);
        return () => set.delete(cb);
      },
      emit(event, payload) {
        const set = ad.listeners.get(event);
        if (set) set.forEach((cb) => cb(payload));
      },
    };
    return ad;
  }
  const mockHooks = { interstitial: null, rewarded: null };
  const mockAdEventType = {
    LOADED: 'loaded',
    OPENED: 'opened',
    IMPRESSION: 'impression',
    CLOSED: 'closed',
    ERROR: 'error',
  };
  const mockRewardedAdEventType = {
    LOADED: 'rewarded_loaded',
    EARNED_REWARD: 'rewarded_earned',
  };
  const mockInitialize = jest.fn(async () => ({}));
  return {
    __esModule: true,
    default: () => ({ initialize: mockInitialize }),
    AdsConsent: {
      gatherConsent: jest.fn(async () => ({
        canRequestAds: true,
        privacyOptionsRequirementStatus: 'REQUIRED',
      })),
      showPrivacyOptionsForm: jest.fn(async () => undefined),
    },
    AdsConsentPrivacyOptionsRequirementStatus: { REQUIRED: 'REQUIRED' },
    RewardedAd: {
      createForAdRequest: jest.fn(() => {
        const ad = mockMakeAd();
        mockHooks.rewarded = ad;
        return ad;
      }),
    },
    InterstitialAd: {
      createForAdRequest: jest.fn(() => {
        const ad = mockMakeAd();
        mockHooks.interstitial = ad;
        return ad;
      }),
    },
    RewardedAdEventType: mockRewardedAdEventType,
    AdEventType: mockAdEventType,
    __mockHooks: mockHooks,
  };
});

import {
  AD_LOAD_TIMEOUT_MS,
  AD_SHOW_TIMEOUT_MS,
  createProductionAdService,
} from '../AdService';

function getMocked() {
  const mod = require('react-native-google-mobile-ads');
  return mod.__mockHooks;
}

describe('AdService R5 bounded timeouts', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('interstitial load rejects with interstitial_load_timeout after AD_LOAD_TIMEOUT_MS', async () => {
    const ads = createProductionAdService();
    await ads.prepareConsentAndSdk();
    const p = ads.adapter.loadInterstitial('ca-app-pub-test/timeout-load');
    // Attach a catch first so the rejection has a handler before we advance
    // the fake clock, then let the microtask queue drain so setTimeout is
    // actually registered inside the load() promise executor.
    const caught = p.catch((err) => err);
    await Promise.resolve();
    jest.advanceTimersByTime(AD_LOAD_TIMEOUT_MS + 1);
    const err = await caught;
    expect(String(err?.message ?? err)).toMatch(/interstitial_load_timeout/);
  });

  it('interstitial show times out to impression=false after AD_SHOW_TIMEOUT_MS', async () => {
    const ads = createProductionAdService();
    await ads.prepareConsentAndSdk();
    const loadP = ads.adapter.loadInterstitial('ca-app-pub-test/timeout-show');
    await Promise.resolve();
    const mocked = getMocked();
    mocked.interstitial.emit('loaded');
    await loadP;
    const showP = ads.adapter.showInterstitial('ca-app-pub-test/timeout-show');
    // No IMPRESSION or CLOSED emitted.
    jest.advanceTimersByTime(AD_SHOW_TIMEOUT_MS + 1);
    await expect(showP).resolves.toEqual({ impression: false });
  });

  it('rewarded load rejects with rewarded_load_timeout after AD_LOAD_TIMEOUT_MS', async () => {
    const ads = createProductionAdService();
    await ads.prepareConsentAndSdk();
    const p = ads.adapter.loadRewarded('ca-app-pub-test/rw-timeout-load');
    const caught = p.catch((err) => err);
    await Promise.resolve();
    jest.advanceTimersByTime(AD_LOAD_TIMEOUT_MS + 1);
    const err = await caught;
    expect(String(err?.message ?? err)).toMatch(/rewarded_load_timeout/);
  });

  it('rewarded show times out to earned=false after AD_SHOW_TIMEOUT_MS', async () => {
    const ads = createProductionAdService();
    await ads.prepareConsentAndSdk();
    const loadP = ads.adapter.loadRewarded('ca-app-pub-test/rw-timeout-show');
    await Promise.resolve();
    const mocked = getMocked();
    mocked.rewarded.emit('rewarded_loaded');
    await loadP;
    const showP = ads.adapter.showRewarded('ca-app-pub-test/rw-timeout-show');
    jest.advanceTimersByTime(AD_SHOW_TIMEOUT_MS + 1);
    await expect(showP).resolves.toEqual({ earned: false });
  });
});
