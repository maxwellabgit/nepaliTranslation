import type { AdAdapter, AdNetworkCall, RewardedLoadOpts } from './adMiddleware';
import type { AdSurface } from '../entitlements/decideAdPresentation';
import { resolveAdUnitConfig } from './adConfig';

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
 *
 * R5: bounded timeouts protect against a missing native callback so the
 * promise chain does not leak an unresolved promise or an orphaned
 * listener. If the SDK never fires LOADED or ERROR within
 * `AD_LOAD_TIMEOUT_MS` the load rejects with `interstitial_load_timeout`
 * (or `rewarded_load_timeout`). If the SDK never fires IMPRESSION or
 * CLOSED within `AD_SHOW_TIMEOUT_MS` the show resolves as no-impression
 * / not-earned; listener handles are removed either way.
 */
export const AD_LOAD_TIMEOUT_MS = 20_000;
export const AD_SHOW_TIMEOUT_MS = 60_000;
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
    setRequestConfiguration?: (config: { testDeviceIdentifiers: string[] }) => Promise<void>;
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
      // v17 `load()` returns void; wire events before calling. R5:
      // a bounded timeout releases listeners and rejects if the SDK
      // never fires LOADED or ERROR.
      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const cleanup = () => {
          if (timer !== null) clearTimeout(timer);
          unsubLoad();
          unsubErr();
        };
        const unsubLoad = ad.addAdEventListener(rewardedLoadedEvent, () => {
          if (settled) return;
          settled = true;
          cleanup();
          rewardedRef = ad;
          resolve();
        });
        const unsubErr = ad.addAdEventListener(rewardedErrorEvent, () => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(new Error('rewarded_load_error'));
        });
        const timer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(new Error('rewarded_load_timeout'));
        }, AD_LOAD_TIMEOUT_MS);
        try {
          ad.load();
        } catch (err) {
          if (settled) return;
          settled = true;
          cleanup();
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
          if (timer !== null) clearTimeout(timer);
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
        // R5: bounded timeout so a missing native CLOSED/ERROR cannot
        // leave the promise pending forever. On timeout we treat the show
        // as not-earned; server-side SSV remains the authoritative grant.
        const timer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
          earned = false;
          done();
        }, AD_SHOW_TIMEOUT_MS);
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
        let settled = false;
        const cleanup = () => {
          if (timer !== null) clearTimeout(timer);
          unsubLoad();
          unsubErr();
        };
        const unsubLoad = ad.addAdEventListener(interstitialLoadedEvent, () => {
          if (settled) return;
          settled = true;
          cleanup();
          interstitialRef = ad;
          resolve();
        });
        const unsubErr = ad.addAdEventListener(interstitialErrorEvent, () => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(new Error('interstitial_load_error'));
        });
        const timer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
          if (settled) return;
          settled = true;
          cleanup();
          reject(new Error('interstitial_load_timeout'));
        }, AD_LOAD_TIMEOUT_MS);
        try {
          ad.load();
        } catch (err) {
          if (settled) return;
          settled = true;
          cleanup();
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
          if (timer !== null) clearTimeout(timer);
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
        // R5: bounded timeout so a missing native callback does not leak.
        // On timeout, treat as no-impression so the daily cap is not spent
        // and the foreground timer does not reset.
        const timer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
          impression = false;
          finish();
        }, AD_SHOW_TIMEOUT_MS);
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
          const ads = native.default();
          const config = resolveAdUnitConfig();
          if (config.env === 'test-ssv') {
            if (!ads.setRequestConfiguration) throw new Error('test_device_configuration_missing');
            await ads.setRequestConfiguration({
              testDeviceIdentifiers: config.testDeviceIdentifiers ?? [],
            });
          }
          await ads.initialize();
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
