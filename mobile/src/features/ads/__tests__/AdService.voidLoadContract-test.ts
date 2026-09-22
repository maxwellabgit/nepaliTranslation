/**
 * G3 contract test: verify AdService tolerates the installed
 * react-native-google-mobile-ads v17 API, where `load()` and `show()`
 * return `void` (not a Promise). The G3 refactor must attach LOADED and
 * ERROR listeners before calling load(), rather than chaining `.catch()`
 * onto a `void` return.
 *
 * NOTE: `jest.mock(...)` must be hoisted before any `import`, and the
 * factory below cannot reference outer-scope classes/types (Jest guards
 * against uninitialized mock variables). Everything the mock needs lives
 * inside the factory; the tests reach it via the module's `__hooks`
 * export using `require()` at call time.
 */
/* eslint-disable import/first */
jest.mock('react-native-google-mobile-ads', () => {
  class MockAd {
    listeners: Map<string, Set<(payload?: unknown) => void>> = new Map();
    load = jest.fn(() => undefined);
    show = jest.fn(() => undefined);
    addAdEventListener(event: string, cb: (payload?: unknown) => void): () => void {
      const set = this.listeners.get(event) ?? new Set<(p?: unknown) => void>();
      set.add(cb);
      this.listeners.set(event, set);
      return () => {
        set.delete(cb);
      };
    }
    emit(event: string, payload?: unknown) {
      const set = this.listeners.get(event);
      if (set) set.forEach((cb) => cb(payload));
    }
  }
  const hooks: { interstitial: MockAd | null; rewarded: MockAd | null } = {
    interstitial: null,
    rewarded: null,
  };
  const AdEventType = {
    LOADED: 'loaded',
    OPENED: 'opened',
    IMPRESSION: 'impression',
    CLOSED: 'closed',
    ERROR: 'error',
  };
  const RewardedAdEventType = {
    LOADED: 'rewarded_loaded',
    EARNED_REWARD: 'rewarded_earned',
  };
  const initialize = jest.fn(async () => ({}));
  return {
    __esModule: true,
    default: () => ({ initialize }),
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
        const ad = new MockAd();
        hooks.rewarded = ad;
        return ad;
      }),
    },
    InterstitialAd: {
      createForAdRequest: jest.fn(() => {
        const ad = new MockAd();
        hooks.interstitial = ad;
        return ad;
      }),
    },
    RewardedAdEventType,
    AdEventType,
    __hooks: hooks,
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
    __hooks: { interstitial: MockAdInstance | null; rewarded: MockAdInstance | null };
    AdEventType: Record<string, string>;
    RewardedAdEventType: Record<string, string>;
  };
  return {
    interstitial: mod.__hooks.interstitial,
    rewarded: mod.__hooks.rewarded,
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
