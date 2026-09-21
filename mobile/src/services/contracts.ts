import type { AdAdapter } from '../features/ads/adMiddleware';
import type { FeatureFlags } from '../app/featureFlags';
import type { FlushResult } from './contributionSync';

/** Optional online identity boundary. */
export type AuthService = {
  isConfigured: () => boolean;
  /** Soft-fail: never throws into the translate path. */
  getSessionUserId: () => Promise<string | null>;
  /** Injected failure for tests; production returns null. */
  lastError: () => string | null;
  setLastError?: (message: string | null) => void;
};

/** Remote/bundled feature flags. Fail soft to safe defaults. */
export type FeatureConfigService = {
  loadFlags: () => Promise<FeatureFlags>;
};

/** Contribution lease/submit/outbox flush boundary. */
export type ContributionService = {
  flushOutbox: () => Promise<FlushResult>;
};

/** Entitlement refresh boundary. */
export type EntitlementService = {
  refresh: () => Promise<void>;
};

/** Connectivity. */
export type NetworkService = {
  isOffline: () => boolean;
  /** Subscribe to connectivity flips. Returns unsubscribe. */
  subscribe: (listener: (offline: boolean) => void) => () => void;
};

export type ConsentState = {
  canRequestAds: boolean;
  privacyOptionsRequired: boolean;
};

/** Ad SDK boundary. Production uses real adapter; mocks are test-only. */
export type AdService = {
  adapter: AdAdapter;
  networkCalls: () => ReturnType<AdAdapter['networkCalls']>;
  prepareConsentAndSdk: () => Promise<ConsentState>;
  getConsentState: () => ConsentState;
  showPrivacyOptions: () => Promise<void>;
};

export type AppServices = {
  auth: AuthService;
  featureConfig: FeatureConfigService;
  contribution: ContributionService;
  entitlement: EntitlementService;
  network: NetworkService;
  ads: AdService;
};
