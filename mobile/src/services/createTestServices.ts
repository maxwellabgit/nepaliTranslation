import { DEFAULT_FEATURE_FLAGS, type FeatureFlags } from '../app/featureFlags';
import { createMockAdAdapter } from '../features/ads/adMiddleware';
import type { AppServices } from './contracts';
import type { FlushResult } from './contributionSync';

export type TestServicesOptions = {
  flags?: Partial<FeatureFlags>;
  offline?: boolean;
  authConfigured?: boolean;
  authError?: string | null;
  flushResult?: FlushResult;
};

/** Deterministic fakes for production-composition integration tests. */
export function createTestServices(
  options: TestServicesOptions = {},
): AppServices & {
  setOffline: (offline: boolean) => void;
  setAuthError: (message: string | null) => void;
} {
  const adAdapter = createMockAdAdapter();
  let offline = options.offline ?? false;
  let authError = options.authError ?? null;
  const netListeners = new Set<(offline: boolean) => void>();
  const flags: FeatureFlags = {
    ...DEFAULT_FEATURE_FLAGS,
    learnEnabled: true,
    ...options.flags,
  };

  const services: AppServices & {
    setOffline: (v: boolean) => void;
    setAuthError: (m: string | null) => void;
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
    },
    setOffline: (next) => {
      offline = next;
      for (const l of netListeners) l(offline);
    },
    setAuthError: (message) => {
      authError = message;
    },
  };
  return services;
}
