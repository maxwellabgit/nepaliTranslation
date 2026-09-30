import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';

import { useFeatureFlags } from '../../app/FeatureConfigProvider';
import { useEntitlementOptional } from '../entitlements/EntitlementProvider';
import { useSubscriptionOptional } from '../subscription/SubscriptionProvider';
import { useServices } from '../../services/ServiceContext';
import {
  createForegroundAccumulator,
  loadForegroundActiveMs,
  resetForegroundActiveMs,
} from './foregroundAdTimer';
import { INTERSTITIAL_MIN_FOREGROUND_MS } from '../entitlements/decideInterstitialPresentation';
import {
  persistForegroundActiveMs,
  runInterstitialOpportunity,
  type InterstitialOpportunityRequest,
} from './interstitialOpportunity';
import { SampleVideoAd } from './SampleVideoAd';

type Listener = (req: InterstitialOpportunityRequest) => void;

const listeners = new Set<Listener>();
const foregroundListeners = new Set<(ms: number) => void>();

/**
 * Live foreground-active milliseconds. The credits gauge and interstitial
 * eligibility both read this value. A confirmed impression publishes 0.
 */
export function subscribeForegroundActiveMs(
  listener: (ms: number) => void,
): () => void {
  foregroundListeners.add(listener);
  return () => {
    foregroundListeners.delete(listener);
  };
}

function publishForegroundMs(ms: number) {
  foregroundListeners.forEach((listener) => listener(ms));
}

function appIsOpen(): boolean {
  const state = AppState.currentState;
  return state !== 'background' && state !== 'inactive';
}

/** Fire a presentation attempt from screens / shell (soft-fail if none listening). */
export function requestInterstitialOpportunity(
  req: InterstitialOpportunityRequest,
): void {
  for (const listener of listeners) {
    listener(req);
  }
}

/**
 * Tracks foreground-active time and presents automatic interstitials when
 * policy allows. Flag defaults off; never required for core translate.
 */
export function InterstitialController() {
  const flags = useFeatureFlags();
  const entitlement = useEntitlementOptional();
  const subscription = useSubscriptionOptional();
  const services = useServices();
  const accumRef = useRef(createForegroundAccumulator(0));
  const readyRef = useRef(false);
  const presentingRef = useRef(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const presentDueRef = useRef<(ms: number) => void>(() => undefined);

  const resetClock = useCallback((now: number) => {
    accumRef.current.onInactive(now);
    accumRef.current.setMs(0);
    if (appIsOpen()) accumRef.current.onActive(now);
    publishForegroundMs(0);
    void resetForegroundActiveMs();
  }, []);

  presentDueRef.current = (ms: number) => {
    if (presentingRef.current || ms < INTERSTITIAL_MIN_FOREGROUND_MS) return;
    if (!flags.automaticInterstitialEnabled) return;
    if (services.network.isOffline()) return;
    if (!services.ads.getConsentState().canRequestAds) return;
    if (subscription?.hasSubscription()) return;
    const until = entitlement?.earnedAdFreeUntilMs ?? null;
    const trusted = entitlement?.trustedNow() ?? null;
    if (until != null && trusted != null && until > trusted) return;
    presentingRef.current = true;
    if (Platform.OS === 'web') {
      setVideoOpen(true);
      resetClock(Date.now());
      return;
    }
    void runInterstitialOpportunity({
      automaticInterstitialEnabled: true,
      offline: false,
      canRequestAds: true,
      appActive: true,
      earnedAdFreeUntilMs: until,
      trustedNowMs: trusted,
      foregroundActiveMs: ms,
      adapter: services.ads.adapter,
      req: {
        transition: 'timer_elapsed',
        surface: 'translate_idle',
        hasSubscription: Boolean(subscription?.hasSubscription()),
      },
    })
      .then(() => {
        resetClock(Date.now());
      })
      .catch(() => undefined)
      .finally(() => {
        presentingRef.current = false;
      });
  };

  useEffect(() => {
    let cancelled = false;
    void loadForegroundActiveMs().then((ms) => {
      if (cancelled) return;
      accumRef.current.setMs(ms);
      readyRef.current = true;
      publishForegroundMs(ms);
      if (appIsOpen()) {
        accumRef.current.onActive(Date.now());
      }
      presentDueRef.current(ms);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const persist = (nowMs: number) => {
      const total = accumRef.current.flush(nowMs);
      void persistForegroundActiveMs(total);
    };

    const onAppState = (next: AppStateStatus) => {
      const now = Date.now();
      if (next === 'active') {
        accumRef.current.onActive(now);
        return;
      }
      if (next !== 'background' && next !== 'inactive') return;
      const total = accumRef.current.onInactive(now);
      void persistForegroundActiveMs(total);
    };

    const sub = AppState.addEventListener('change', onAppState);
    const interval = setInterval(() => {
      if (AppState.currentState === 'active' && readyRef.current) {
        persist(Date.now());
      }
    }, 30_000);
    const countdown = setInterval(() => {
      if (!appIsOpen() || !readyRef.current) return;
      const ms = accumRef.current.flush(Date.now());
      publishForegroundMs(ms);
      presentDueRef.current(ms);
    }, 1_000);

    return () => {
      sub.remove();
      clearInterval(interval);
      clearInterval(countdown);
      if (AppState.currentState === 'active') {
        persist(Date.now());
      }
    };
  }, []);

  useEffect(() => {
    const onOpportunity = (req: InterstitialOpportunityRequest) => {
      if (presentingRef.current) return;
      presentingRef.current = true;
      const foregroundActiveMs = accumRef.current.flush(Date.now());
      void runInterstitialOpportunity({
        automaticInterstitialEnabled: flags.automaticInterstitialEnabled,
        offline: services.network.isOffline(),
        canRequestAds: services.ads.getConsentState().canRequestAds,
        appActive: AppState.currentState === 'active',
        earnedAdFreeUntilMs: entitlement?.earnedAdFreeUntilMs ?? null,
        trustedNowMs: entitlement?.trustedNow() ?? null,
        foregroundActiveMs,
        adapter: services.ads.adapter,
        req: {
          ...req,
          hasSubscription:
            req.hasSubscription ?? Boolean(subscription?.hasSubscription()),
        },
      })
        .then((result) => {
          if (result && 'presented' in result && result.presented) {
            const now = Date.now();
            accumRef.current.onInactive(now);
            accumRef.current.setMs(0);
            if (AppState.currentState === 'active') {
              accumRef.current.onActive(now);
            }
            publishForegroundMs(0);
            void resetForegroundActiveMs();
          }
        })
        .catch(() => undefined)
        .finally(() => {
          presentingRef.current = false;
        });
    };

    listeners.add(onOpportunity);
    return () => {
      listeners.delete(onOpportunity);
    };
  }, [entitlement, flags.automaticInterstitialEnabled, services, subscription]);

  return (
    <SampleVideoAd
      visible={videoOpen}
      onFinished={() => {
        setVideoOpen(false);
        resetClock(Date.now());
        presentingRef.current = false;
      }}
    />
  );
}
