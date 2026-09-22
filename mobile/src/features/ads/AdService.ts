import type { AdAdapter, AdNetworkCall, RewardedLoadOpts } from './adMiddleware';
import type { AdSurface } from '../entitlements/decideAdPresentation';

export type ConsentState = {
  canRequestAds: boolean;
  privacyOptionsRequired: boolean;
};

export type AdService = {
  adapter: AdAdapter;
  networkCalls: () => AdNetworkCall[];
  /** UMP first; initialize SDK only when canRequestAds. No ATT/IDFA. */
  prepareConsentAndSdk: () => Promise<ConsentState>;
  getConsentState: () => ConsentState;
  showPrivacyOptions: () => Promise<void>;
};

/**
 * `react-native-google-mobile-ads` v17 API — `load()` and `show()` return
 * `void`, not a Promise. Calling `.catch()` on those returns will throw a
 * TypeError at runtime. G3 refactor listens for LOADED / ERROR / CLOSED
 * events instead of chaining onto load/show.
 */
type NativeAdInstance = {
  load: () => void;
  show: () => void;
  addAdEventListener: (
    event: string,
    cb: (payload?: unknown) => void,
  ) => () => void;
};

type NativeAdsModule = {
  default: () => {
    initialize: () => Promise<unknown>;
  };
  AdsConsent: {
    gatherConsent: () => Promise<{
      canRequestAds: boolean;
      privacyOptionsRequirementStatus: string;
    }>;
    showPrivacyOptionsForm: () => Promise<unknown>;
  };
  AdsConsentPrivacyOptionsRequirementStatus: {
    REQUIRED: string;
  };
  RewardedAd: {
    createForAdRequest: (
      unitId: string,
      opts?: { serverSideVerificationOptions?: { userId?: string; customData?: string } },
    ) => NativeAdInstance;
  };
  InterstitialAd: {
    createForAdRequest: (unitId: string) => NativeAdInstance;
  };
  RewardedAdEventType: { LOADED: string; EARNED_REWARD: string };
  AdEventType: {
    LOADED: string;
    OPENED?: string;
    IMPRESSION?: string;
    CLOSED: string;
    ERROR: string;
  };
};

async function tryLoadNative(): Promise<NativeAdsModule | null> {
  try {
    // Dynamic require so Expo Go / Jest without native module soft-fail.
    return require('react-native-google-mobile-ads') as NativeAdsModule;
  } catch {
    return null;
  }
}

/**
 * Production AdService: real adapter when the native module is present.
 * Soft-fails to a no-network house-only adapter when the SDK is unavailable.
 */
export function createProductionAdService(): AdService {
  const network: AdNetworkCall[] = [];
  let consent: ConsentState = {
    canRequestAds: false,
    privacyOptionsRequired: false,
  };
  let sdkReady = false;
  let rewardedRef: NativeAdInstance | null = null;
  let interstitialRef: NativeAdInstance | null = null;
  let earnedEventType = 'earned_reward';
  let interstitialLoadedEvent = 'loaded';
  let interstitialErrorEvent = 'error';
  let interstitialClosedEvent = 'closed';
  let interstitialImpressionEvent: string | null = null;
  let rewardedLoadedEvent = 'loaded';
  let rewardedErrorEvent = 'error';
  let rewardedClosedEvent = 'closed';

  const adapter: AdAdapter = {
    async loadBanner(unitId) {
      network.push({ kind: 'banner_load', unitId, atMs: Date.now() });
      // Banner UI is rendered by BannerAd component; this records intent.
    },
    async showBanner(unitId) {
      network.push({ kind: 'banner_show', unitId, atMs: Date.now() });
    },
    async loadRewarded(unitId, opts?: RewardedLoadOpts) {
      network.push({ kind: 'rewarded_load', unitId, atMs: Date.now() });
      const native = await tryLoadNative();
      if (!native || !sdkReady) return;
      earnedEventType = native.RewardedAdEventType.EARNED_REWARD;
      rewardedLoadedEvent = native.RewardedAdEventType.LOADED;
      rewardedErrorEvent = native.AdEventType.ERROR;
      rewardedClosedEvent = native.AdEventType.CLOSED;
      const ad = native.RewardedAd.createForAdRequest(unitId, {
        serverSideVerificationOptions: {
          userId: opts?.userId,
          customData: opts?.customData,
        },
      });
      // v17 `load()` returns void; wire events before calling.
      await new Promise<void>((resolve, reject) => {
        const unsubLoad = ad.addAdEventListener(rewardedLoadedEvent, () => {
          unsubLoad();
          unsubErr();
          rewardedRef = ad;
          resolve();
        });
        const unsubErr = ad.addAdEventListener(rewardedErrorEvent, () => {
          unsubLoad();
          unsubErr();
          reject(new Error('rewarded_load_error'));
        });
        try {
          ad.load();
        } catch (err) {
          unsubLoad();
          unsubErr();
          reject(err instanceof Error ? err : new Error('rewarded_load_throw'));
        }
      });
    },
    async showRewarded(unitId) {
      network.push({ kind: 'rewarded_show', unitId, atMs: Date.now() });
      const ad = rewardedRef;
      rewardedRef = null;
      if (!ad) return { earned: false };
      return await new Promise<{ earned: boolean }>((resolve) => {
        let earned = false;
        let settled = false;
        const done = () => {
          if (settled) return;
          settled = true;
          unsubEarn();
          unsubClose();
          unsubErr();
          resolve({ earned });
        };
        const unsubEarn = ad.addAdEventListener(earnedEventType, () => {
          earned = true;
        });
        const unsubClose = ad.addAdEventListener(rewardedClosedEvent, done);
        const unsubErr = ad.addAdEventListener(rewardedErrorEvent, done);
        try {
          ad.show();
        } catch {
          done();
        }
      });
    },
    async loadInterstitial(unitId) {
      network.push({ kind: 'interstitial_load', unitId, atMs: Date.now() });
      const native = await tryLoadNative();
      if (!native || !sdkReady) return;
      interstitialLoadedEvent = native.AdEventType.LOADED;
      interstitialErrorEvent = native.AdEventType.ERROR;
      interstitialClosedEvent = native.AdEventType.CLOSED;
      interstitialImpressionEvent = native.AdEventType.IMPRESSION ?? null;
      const ad = native.InterstitialAd.createForAdRequest(unitId);
      await new Promise<void>((resolve, reject) => {
        const unsubLoad = ad.addAdEventListener(interstitialLoadedEvent, () => {
          unsubLoad();
          unsubErr();
          interstitialRef = ad;
          resolve();
        });
        const unsubErr = ad.addAdEventListener(interstitialErrorEvent, () => {
          unsubLoad();
          unsubErr();
          reject(new Error('interstitial_load_error'));
        });
        try {
          ad.load();
        } catch (err) {
          unsubLoad();
          unsubErr();
          reject(err instanceof Error ? err : new Error('interstitial_load_throw'));
        }
      });
    },
    async showInterstitial(unitId) {
      network.push({ kind: 'interstitial_show', unitId, atMs: Date.now() });
      const ad = interstitialRef;
      interstitialRef = null;
      if (!ad) return { impression: false };
      // SDK owns presentation and dismissal — no custom skip UI. We resolve
      // with impression=true when the SDK reports IMPRESSION (or CLOSED as
      // a fallback for older builds), and impression=false on ERROR.
      return await new Promise<{ impression: boolean }>((resolve) => {
        let impression = false;
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          unsubImp();
          unsubClose();
          unsubErr();
          resolve({ impression });
        };
        const unsubImp = interstitialImpressionEvent
          ? ad.addAdEventListener(interstitialImpressionEvent, () => {
              impression = true;
            })
          : () => {};
        const unsubClose = ad.addAdEventListener(
          interstitialClosedEvent,
          () => {
            if (!interstitialImpressionEvent) impression = true;
            finish();
          },
        );
        const unsubErr = ad.addAdEventListener(interstitialErrorEvent, () => {
          impression = false;
          finish();
        });
        try {
          ad.show();
        } catch {
          finish();
        }
      });
    },
    showHouseAd(_surface: AdSurface) {
      /* UI renders house copy */
    },
    networkCalls: () => [...network],
  };

  return {
    adapter,
    networkCalls: () => adapter.networkCalls(),
    getConsentState: () => consent,
    async prepareConsentAndSdk() {
      const native = await tryLoadNative();
      if (!native) {
        consent = { canRequestAds: false, privacyOptionsRequired: false };
        return consent;
      }
      try {
        const info = await native.AdsConsent.gatherConsent();
        consent = {
          canRequestAds: Boolean(info.canRequestAds),
          privacyOptionsRequired:
            info.privacyOptionsRequirementStatus ===
            native.AdsConsentPrivacyOptionsRequirementStatus.REQUIRED,
        };
        if (consent.canRequestAds) {
          await native.default().initialize();
          sdkReady = true;
        }
      } catch {
        consent = { canRequestAds: false, privacyOptionsRequired: false };
      }
      return consent;
    },
    async showPrivacyOptions() {
      const native = await tryLoadNative();
      if (!native) return;
      try {
        await native.AdsConsent.showPrivacyOptionsForm();
      } catch {
        /* soft-fail */
      }
    },
  };
}
