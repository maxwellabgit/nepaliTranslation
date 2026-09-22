import * as Network from 'expo-network';
import { DEFAULT_FEATURE_FLAGS } from '../app/featureFlags';
import { createProductionAdService } from '../features/ads/AdService';
import { flushPendingDrafts } from './contributionSync';
import { flushPendingMedia } from './mediaSync';
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

function mapRemoteFlags(data: Record<string, unknown>) {
  const text =
    typeof data.contribution_text_enabled === 'boolean'
      ? data.contribution_text_enabled
      : Boolean(data.contributions_enabled);
  return {
    contributionTextEnabled: text,
    contributionSpeechEnabled: Boolean(data.contribution_speech_enabled),
    contributionPhotosEnabled: Boolean(data.contribution_photos_enabled),
    rewardsEnabled: Boolean(data.rewards_enabled),
    networkAdsEnabled: Boolean(data.network_ads_enabled),
    rewardedAdsEnabled: Boolean(data.rewarded_ads_enabled),
    paywallEnabled: Boolean(data.paywall_enabled),
    learnEnabled: true,
  };
}

/**
 * Production adapters. Native AdMob via AdService; network ads stay flag-off
 * until the human device gate enables remote flags.
 */
export function createProductionServices(): AppServices {
  const ads = createProductionAdService();
  let lastAuthError: string | null = null;
  const netListeners = new Set<(offline: boolean) => void>();
  let offline = false;

  const setOffline = (next: boolean) => {
    if (offline === next) return;
    offline = next;
    for (const listener of netListeners) listener(offline);
  };

  void Network.getNetworkStateAsync()
    .then((state) => setOffline(stateIsOffline(state)))
    .catch(() => undefined);

  try {
    Network.addNetworkStateListener((state) => {
      setOffline(stateIsOffline(state));
    });
  } catch {
    /* soft-fail */
  }

  // UMP before ads; soft-fail leaves canRequestAds false → house only.
  void ads.prepareConsentAndSdk();

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
        const sb = getSupabase();
        if (!sb) {
          return { ...DEFAULT_FEATURE_FLAGS, learnEnabled: true };
        }
        try {
          const { data, error } = await sb
            .from('app_config')
            .select(
              'contribution_text_enabled, contribution_speech_enabled, contribution_photos_enabled, contributions_enabled, rewards_enabled, network_ads_enabled, rewarded_ads_enabled, paywall_enabled, learn_enabled',
            )
            .eq('id', 1)
            .maybeSingle();
          if (error || !data) {
            return { ...DEFAULT_FEATURE_FLAGS, learnEnabled: true };
          }
          return mapRemoteFlags(data as Record<string, unknown>);
        } catch {
          return { ...DEFAULT_FEATURE_FLAGS, learnEnabled: true };
        }
      },
    },
    contribution: {
      flushOutbox: () => flushPendingDrafts(),
      flushMediaOutbox: () => flushPendingMedia(),
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
    ads,
  };
}
