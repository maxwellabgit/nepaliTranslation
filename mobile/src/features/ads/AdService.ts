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
    ) => {
      load: () => Promise<void>;
      show: () => Promise<void>;
      addAdEventListener: (event: string, cb: () => void) => () => void;
    };
  };
  RewardedAdEventType: { LOADED: string; EARNED_REWARD: string };
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
  let rewardedRef: {
    show: () => Promise<void>;
    addAdEventListener: (event: string, cb: () => void) => () => void;
  } | null = null;
  let earnedEventType = 'earned_reward';

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
      const ad = native.RewardedAd.createForAdRequest(unitId, {
        serverSideVerificationOptions: {
          userId: opts?.userId,
          customData: opts?.customData,
        },
      });
      await new Promise<void>((resolve, reject) => {
        const unsub = ad.addAdEventListener(
          native.RewardedAdEventType.LOADED,
          () => {
            unsub();
            rewardedRef = ad;
            resolve();
          },
        );
        ad.load().catch(reject);
      });
    },
    async showRewarded(unitId) {
      network.push({ kind: 'rewarded_show', unitId, atMs: Date.now() });
      const ad = rewardedRef;
      rewardedRef = null;
      if (!ad) return { earned: false };
      return await new Promise<{ earned: boolean }>((resolve) => {
        let earned = false;
        const unsub = ad.addAdEventListener(earnedEventType, () => {
          earned = true;
        });
        void ad
          .show()
          .catch(() => undefined)
          .finally(() => {
            unsub();
            resolve({ earned });
          });
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
