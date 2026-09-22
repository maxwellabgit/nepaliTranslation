/**
 * G3 contract test: verify AdService tolerates the installed
 * react-native-google-mobile-ads v17 API, where `load()` and `show()`
 * return `void` (not a Promise). The G3 refactor must attach LOADED and
 * ERROR listeners before calling load(), rather than chaining `.catch()`
 * onto a `void` return.
 */
import { createProductionAdService } from '../AdService';

type Listener = (payload?: unknown) => void;

class FakeAd {
  listeners = new Map<string, Set<Listener>>();
  load = jest.fn<void, []>(() => undefined);
  show = jest.fn<void, []>(() => undefined);
  addAdEventListener(event: string, cb: Listener): () => void {
    const set = this.listeners.get(event) ?? new Set<Listener>();
    set.add(cb);
    this.listeners.set(event, set);
    return () => {
      set.delete(cb);
    };
  }
  emit(event: string, payload?: unknown) {
    this.listeners.get(event)?.forEach((cb) => cb(payload));
  }
}

const currentInterstitial: { ad: FakeAd | null } = { ad: null };
const currentRewarded: { ad: FakeAd | null } = { ad: null };

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

jest.mock('react-native-google-mobile-ads', () => {
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
        const ad = new FakeAd();
        currentRewarded.ad = ad;
        return ad;
      }),
    },
    InterstitialAd: {
      createForAdRequest: jest.fn(() => {
        const ad = new FakeAd();
        currentInterstitial.ad = ad;
        return ad;
      }),
    },
    RewardedAdEventType,
    AdEventType,
  };
});

describe('AdService v17 void-load contract (G3)', () => {
  it('interstitial load resolves on LOADED event without chaining onto load()', async () => {
    const ads = createProductionAdService();
    await ads.prepareConsentAndSdk();
    const loadPromise = ads.adapter.loadInterstitial('ca-app-pub-test/12345');
    // Simulate SDK firing LOADED asynchronously.
    await Promise.resolve();
    currentInterstitial.ad?.emit(AdEventType.LOADED);
    await expect(loadPromise).resolves.toBeUndefined();
    expect(currentInterstitial.ad?.load).toHaveBeenCalledTimes(1);
  });

  it('interstitial load rejects on ERROR event without unhandled TypeError', async () => {
    const ads = createProductionAdService();
    await ads.prepareConsentAndSdk();
    const loadPromise = ads.adapter.loadInterstitial('ca-app-pub-test/22222');
    await Promise.resolve();
    currentInterstitial.ad?.emit(AdEventType.ERROR);
    await expect(loadPromise).rejects.toThrow(/interstitial_load_error/);
  });

  it('showInterstitial reports impression=true only after IMPRESSION+CLOSED', async () => {
    const ads = createProductionAdService();
    await ads.prepareConsentAndSdk();
    const loadPromise = ads.adapter.loadInterstitial('ca-app-pub-test/33333');
    await Promise.resolve();
    currentInterstitial.ad?.emit(AdEventType.LOADED);
    await loadPromise;
    const showPromise = ads.adapter.showInterstitial('ca-app-pub-test/33333');
    await Promise.resolve();
    currentInterstitial.ad?.emit(AdEventType.IMPRESSION);
    currentInterstitial.ad?.emit(AdEventType.CLOSED);
    await expect(showPromise).resolves.toEqual({ impression: true });
  });

  it('showInterstitial reports impression=false on ERROR', async () => {
    const ads = createProductionAdService();
    await ads.prepareConsentAndSdk();
    const loadPromise = ads.adapter.loadInterstitial('ca-app-pub-test/44444');
    await Promise.resolve();
    currentInterstitial.ad?.emit(AdEventType.LOADED);
    await loadPromise;
    const showPromise = ads.adapter.showInterstitial('ca-app-pub-test/44444');
    await Promise.resolve();
    currentInterstitial.ad?.emit(AdEventType.ERROR);
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
    currentRewarded.ad?.emit(RewardedAdEventType.LOADED);
    await expect(loadPromise).resolves.toBeUndefined();

    const failPromise = ads.adapter.loadRewarded('ca-app-pub-test/66666');
    await Promise.resolve();
    currentRewarded.ad?.emit(AdEventType.ERROR);
    await expect(failPromise).rejects.toThrow(/rewarded_load_error/);
  });

  it('rewarded show resolves earned=true only after EARNED_REWARD + CLOSED', async () => {
    const ads = createProductionAdService();
    await ads.prepareConsentAndSdk();
    const loadPromise = ads.adapter.loadRewarded('ca-app-pub-test/77777');
    await Promise.resolve();
    currentRewarded.ad?.emit(RewardedAdEventType.LOADED);
    await loadPromise;
    const showPromise = ads.adapter.showRewarded('ca-app-pub-test/77777');
    await Promise.resolve();
    currentRewarded.ad?.emit(RewardedAdEventType.EARNED_REWARD);
    currentRewarded.ad?.emit(AdEventType.CLOSED);
    await expect(showPromise).resolves.toEqual({ earned: true });
  });

  it('rewarded show without EARNED_REWARD resolves earned=false on CLOSED', async () => {
    const ads = createProductionAdService();
    await ads.prepareConsentAndSdk();
    const loadPromise = ads.adapter.loadRewarded('ca-app-pub-test/88888');
    await Promise.resolve();
    currentRewarded.ad?.emit(RewardedAdEventType.LOADED);
    await loadPromise;
    const showPromise = ads.adapter.showRewarded('ca-app-pub-test/88888');
    await Promise.resolve();
    currentRewarded.ad?.emit(AdEventType.CLOSED);
    await expect(showPromise).resolves.toEqual({ earned: false });
  });
});
