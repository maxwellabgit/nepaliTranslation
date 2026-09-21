import type { AdAdapter, AdNetworkCall } from './adMiddleware';

type ConsentState = {
  canRequestAds: boolean;
  privacyOptionsRequired: boolean;
};

type AdService = {
  adapter: AdAdapter;
  networkCalls: () => AdNetworkCall[];
  prepareConsentAndSdk: () => Promise<ConsentState>;
  getConsentState: () => ConsentState;
  showPrivacyOptions: () => Promise<void>;
};

/**
 * Web manual-test adapter. Native AdMob is iOS-only and cannot load in the browser.
 */
export function createProductionAdService(): AdService {
  const network: AdNetworkCall[] = [];
  const consent: ConsentState = {
    canRequestAds: false,
    privacyOptionsRequired: false,
  };
  const adapter: AdAdapter = {
    async loadBanner() {
      return undefined;
    },
    async showBanner() {
      return undefined;
    },
    async loadRewarded() {
      return undefined;
    },
    async showRewarded() {
      return { earned: false };
    },
    showHouseAd() {
      return undefined;
    },
    networkCalls: () => network.slice(),
  };
  return {
    adapter,
    networkCalls: () => network.slice(),
    prepareConsentAndSdk: async () => consent,
    getConsentState: () => consent,
    showPrivacyOptions: async () => undefined,
  };
}
