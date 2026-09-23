import { DEFAULT_FEATURE_FLAGS, type FeatureFlags } from '../app/featureFlags';
import { createMockAdAdapter } from '../features/ads/adMiddleware';
import { createFakePurchaseService } from '../features/subscription/PurchaseService';
import type { AppServices, ConsentState } from './contracts';
import type { FlushResult } from './contributionSync';
import type { MediaFlushResult } from './mediaSync';

export type TestServicesOptions = {
  flags?: Partial<FeatureFlags>;
  offline?: boolean;
  authConfigured?: boolean;
  authError?: string | null;
  flushResult?: FlushResult;
  mediaFlushResult?: MediaFlushResult;
  canRequestAds?: boolean;
  privacyOptionsRequired?: boolean;
  hasSubscription?: boolean;
  /** Purchase/restore return unavailable (Playwright IAP soft-fail). */
  iapSoftFail?: boolean;
};

/** Deterministic fakes for production-composition integration tests. */
export function createTestServices(
  options: TestServicesOptions = {},
): AppServices & {
  setOffline: (offline: boolean) => void;
  setAuthError: (message: string | null) => void;
  setConsent: (state: ConsentState) => void;
} {
  const adAdapter = createMockAdAdapter();
  const purchases = createFakePurchaseService(
    options.hasSubscription
      ? {
          initial: {
            status: 'active',
            productId: 'neptranslate_adfree_monthly',
            priceString: '$2.99',
            expiresAtMs: Date.now() + 86_400_000,
            updatedAtMs: Date.now(),
          },
          softFail: options.iapSoftFail,
        }
      : { softFail: options.iapSoftFail },
  );
  let offline = options.offline ?? false;
  let authError = options.authError ?? null;
  let consent: ConsentState = {
    canRequestAds: options.canRequestAds ?? false,
    privacyOptionsRequired: options.privacyOptionsRequired ?? false,
  };
  const netListeners = new Set<(offline: boolean) => void>();
  const flags: FeatureFlags = {
    ...DEFAULT_FEATURE_FLAGS,
    learnEnabled: true,
    ...options.flags,
  };

  const services: AppServices & {
    setOffline: (v: boolean) => void;
    setAuthError: (m: string | null) => void;
    setConsent: (s: ConsentState) => void;
  } = {
    auth: {
      isConfigured: () => options.authConfigured ?? false,
      getSessionUserId: async () => null,
      lastError: () => authError,
      setLastError: (message) => {
        authError = message;
      },
    },
    featureConfig: {
      loadFlags: async () => ({ ...flags }),
    },
    contribution: {
      flushOutbox: async () =>
        options.flushResult ?? { ok: false, reason: 'unavailable' },
      flushMediaOutbox: async () =>
        options.mediaFlushResult ?? { ok: false, reason: 'unavailable' },
    },
    entitlement: {
      refresh: async () => undefined,
    },
    network: {
      isOffline: () => offline,
      subscribe: (listener) => {
        netListeners.add(listener);
        return () => {
          netListeners.delete(listener);
        };
      },
    },
    ads: {
      adapter: adAdapter,
      networkCalls: () => adAdapter.networkCalls(),
      prepareConsentAndSdk: async () => consent,
      getConsentState: () => consent,
      showPrivacyOptions: async () => undefined,
    },
    purchases,
    setOffline: (next) => {
      offline = next;
      for (const l of netListeners) l(offline);
    },
    setAuthError: (message) => {
      authError = message;
    },
    setConsent: (next) => {
      consent = next;
    },
  };
  return services;
}
