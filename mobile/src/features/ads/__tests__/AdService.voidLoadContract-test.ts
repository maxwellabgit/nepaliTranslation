// @ts-nocheck
/**
 * G3 contract test: verify AdService tolerates the installed
 * react-native-google-mobile-ads v17 API, where `load()` and `show()`
 * return `void` (not a Promise). The G3 refactor must attach LOADED and
 * ERROR listeners before calling load(), rather than chaining `.catch()`
 * onto a `void` return.
 *
 * Hoisting rules
 * --------------
 * `jest.mock(...)` is hoisted to the top of the file. Its factory body
 * is scanned by `babel-plugin-jest-hoist`, which rejects any identifier
 * that (a) is not in a fixed allowlist and (b) does not begin with the
 * case-insensitive `mock` prefix. TypeScript type parameters and the
 * parameters of nested arrow types (e.g. `Set<(p?: unknown) => void>`)
 * are visited BEFORE TypeScript strips them, so `p` looks like a naked
 * identifier and Babel refuses the file.
 *
 * The factory below is therefore **plain JavaScript** — no TS type
 * annotations, no generics, no arrow-type parameters. Types used by the
 * tests live outside the factory. Tests reach the mock instances via
 * the module's `__mockHooks` export using `require()` at call time.
 *
 * `@ts-nocheck` at file top: the factory body is deliberately untyped so
 * `babel-plugin-jest-hoist` cannot object. TypeScript would otherwise
 * complain about implicit-`any` inside the factory even though the
 * runtime behavior is correct.
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
        return () => {
          set.delete(cb);
        };
      },
      emit(event, payload) {
        const set = ad.listeners.get(event);
        if (set) {
          set.forEach((cb) => cb(payload));
        }
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

import { createProductionAdService } from '../AdService';

type MockAdInstance = {
  emit: (event: string, payload?: unknown) => void;
  load: jest.Mock;
  show: jest.Mock;
};

function getMocked(): {
  interstitial: MockAdInstance | null;
  rewarded: MockAdInstance | null;
  AdEventType: Record<string, string>;
  RewardedAdEventType: Record<string, string>;
} {
  const mod = require('react-native-google-mobile-ads') as {
    __mockHooks: {
      interstitial: MockAdInstance | null;
      rewarded: MockAdInstance | null;
    };
    AdEventType: Record<string, string>;
    RewardedAdEventType: Record<string, string>;
  };
  return {
    interstitial: mod.__mockHooks.interstitial,
    rewarded: mod.__mockHooks.rewarded,
    AdEventType: mod.AdEventType,
    RewardedAdEventType: mod.RewardedAdEventType,
  };
}

describe('AdService v17 void-load contract (G3)', () => {
  it('interstitial load resolves on LOADED event without chaining onto load()', async () => {
    const ads = createProductionAdService();
    await ads.prepareConsentAndSdk();
    const loadPromise = ads.adapter.loadInterstitial('ca-app-pub-test/12345');
    await Promise.resolve();
    const { interstitial, AdEventType } = getMocked();
    interstitial?.emit(AdEventType.LOADED);
    await expect(loadPromise).resolves.toBeUndefined();
    expect(interstitial?.load).toHaveBeenCalledTimes(1);
  });

  it('interstitial load rejects on ERROR event without unhandled TypeError', async () => {
    const ads = createProductionAdService();
    await ads.prepareConsentAndSdk();
    const loadPromise = ads.adapter.loadInterstitial('ca-app-pub-test/22222');
    await Promise.resolve();
    const { interstitial, AdEventType } = getMocked();
    interstitial?.emit(AdEventType.ERROR);
    await expect(loadPromise).rejects.toThrow(/interstitial_load_error/);
  });

  it('showInterstitial reports impression=true only after IMPRESSION+CLOSED', async () => {
    const ads = createProductionAdService();
    await ads.prepareConsentAndSdk();
    const loadPromise = ads.adapter.loadInterstitial('ca-app-pub-test/33333');
    await Promise.resolve();
    let mocked = getMocked();
    mocked.interstitial?.emit(mocked.AdEventType.LOADED);
    await loadPromise;
    const showPromise = ads.adapter.showInterstitial('ca-app-pub-test/33333');
    await Promise.resolve();
    mocked = getMocked();
    mocked.interstitial?.emit(mocked.AdEventType.IMPRESSION);
    mocked.interstitial?.emit(mocked.AdEventType.CLOSED);
    await expect(showPromise).resolves.toEqual({ impression: true });
  });

  it('showInterstitial reports impression=false on ERROR', async () => {
    const ads = createProductionAdService();
    await ads.prepareConsentAndSdk();
    const loadPromise = ads.adapter.loadInterstitial('ca-app-pub-test/44444');
    await Promise.resolve();
    let mocked = getMocked();
    mocked.interstitial?.emit(mocked.AdEventType.LOADED);
    await loadPromise;
    const showPromise = ads.adapter.showInterstitial('ca-app-pub-test/44444');
    await Promise.resolve();
    mocked = getMocked();
    mocked.interstitial?.emit(mocked.AdEventType.ERROR);
    await expect(showPromise).resolves.toEqual({ impression: false });
  });

  it('rewarded load resolves on LOADED and rejects on ERROR', async () => {
    const ads = createProductionAdService();
    await ads.prepareConsentAndSdk();
    const loadPromise = ads.adapter.loadRewarded('ca-app-pub-test/55555', {
      userId: 'u-1',
      customData: 'sess-1',
    });
    await Promise.resolve();
    let mocked = getMocked();
    mocked.rewarded?.emit(mocked.RewardedAdEventType.LOADED);
    await expect(loadPromise).resolves.toBeUndefined();

    const failPromise = ads.adapter.loadRewarded('ca-app-pub-test/66666');
    await Promise.resolve();
    mocked = getMocked();
    mocked.rewarded?.emit(mocked.AdEventType.ERROR);
    await expect(failPromise).rejects.toThrow(/rewarded_load_error/);
  });

  it('rewarded show resolves earned=true only after EARNED_REWARD + CLOSED', async () => {
    const ads = createProductionAdService();
    await ads.prepareConsentAndSdk();
    const loadPromise = ads.adapter.loadRewarded('ca-app-pub-test/77777');
    await Promise.resolve();
    let mocked = getMocked();
    mocked.rewarded?.emit(mocked.RewardedAdEventType.LOADED);
    await loadPromise;
    const showPromise = ads.adapter.showRewarded('ca-app-pub-test/77777');
    await Promise.resolve();
    mocked = getMocked();
    mocked.rewarded?.emit(mocked.RewardedAdEventType.EARNED_REWARD);
    mocked.rewarded?.emit(mocked.AdEventType.CLOSED);
    await expect(showPromise).resolves.toEqual({ earned: true });
  });

  it('rewarded show without EARNED_REWARD resolves earned=false on CLOSED', async () => {
    const ads = createProductionAdService();
    await ads.prepareConsentAndSdk();
    const loadPromise = ads.adapter.loadRewarded('ca-app-pub-test/88888');
    await Promise.resolve();
    let mocked = getMocked();
    mocked.rewarded?.emit(mocked.RewardedAdEventType.LOADED);
    await loadPromise;
    const showPromise = ads.adapter.showRewarded('ca-app-pub-test/88888');
    await Promise.resolve();
    mocked = getMocked();
    mocked.rewarded?.emit(mocked.AdEventType.CLOSED);
    await expect(showPromise).resolves.toEqual({ earned: false });
  });
});
