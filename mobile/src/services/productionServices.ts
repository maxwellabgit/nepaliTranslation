import * as Network from 'expo-network';
import { DEFAULT_FEATURE_FLAGS } from '../app/featureFlags';
import { createMockAdAdapter } from '../features/ads/adMiddleware';
import { flushPendingDrafts } from './contributionSync';
import { getSupabase } from './supabase';
import type { AppServices } from './contracts';

function stateIsOffline(state: {
  isConnected?: boolean | null;
  isInternetReachable?: boolean | null;
}): boolean {
  if (state.isConnected === false) return true;
  if (state.isInternetReachable === false) return true;
  return false;
}

/**
 * Production adapters. Ads stay on the mock until H6 installs native AdMob;
 * network ads remain flag-off by default.
 */
export function createProductionServices(): AppServices {
  const adAdapter = createMockAdAdapter();
  let lastAuthError: string | null = null;
  const netListeners = new Set<(offline: boolean) => void>();
  let offline = false;

  const setOffline = (next: boolean) => {
    if (offline === next) return;
    offline = next;
    for (const listener of netListeners) listener(offline);
  };

  // Best-effort initial read + live subscription. Soft-fail leaves offline=false.
  void Network.getNetworkStateAsync()
    .then((state) => setOffline(stateIsOffline(state)))
    .catch(() => undefined);

  try {
    Network.addNetworkStateListener((state) => {
      setOffline(stateIsOffline(state));
    });
  } catch {
    /* soft-fail: foreground / sign-in flush still run */
  }

  return {
    auth: {
      isConfigured: () => getSupabase() != null,
      getSessionUserId: async () => {
        const sb = getSupabase();
        if (!sb) return null;
        const { data } = await sb.auth.getSession();
        return data.session?.user?.id ?? null;
      },
      lastError: () => lastAuthError,
      setLastError: (message) => {
        lastAuthError = message;
      },
    },
    featureConfig: {
      loadFlags: async () => {
        // Remote load lands in H3; bundled safe defaults for H1.
        return { ...DEFAULT_FEATURE_FLAGS, learnEnabled: true };
      },
    },
    contribution: {
      flushOutbox: () => flushPendingDrafts(),
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
  };
}
