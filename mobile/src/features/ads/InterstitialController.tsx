import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { useFeatureFlags } from '../../app/FeatureConfigProvider';
import { useEntitlementOptional } from '../entitlements/EntitlementProvider';
import { useServices } from '../../services/ServiceContext';
import { resolveAdUnitConfig } from './adConfig';
import {
  createForegroundAccumulator,
  loadForegroundActiveMs,
} from './foregroundAdTimer';
import {
  persistForegroundActiveMs,
  tryPresentInterstitial,
  type InterstitialTransition,
} from './interstitialOpportunity';
import type { InterstitialSurface } from '../entitlements/decideInterstitialPresentation';

export type InterstitialOpportunityRequest = {
  transition: InterstitialTransition;
  surface: InterstitialSurface;
  cameraActive?: boolean;
  resultUnderReview?: boolean;
  modalVisible?: boolean;
  keyboardVisible?: boolean;
  listening?: boolean;
  speaking?: boolean;
  translating?: boolean;
  hasSubscription?: boolean;
};

type Listener = (req: InterstitialOpportunityRequest) => void;

const listeners = new Set<Listener>();

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
  const services = useServices();
  const accumRef = useRef(createForegroundAccumulator(0));
  const readyRef = useRef(false);
  const presentingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void loadForegroundActiveMs().then((ms) => {
      if (cancelled) return;
      accumRef.current.setMs(ms);
      readyRef.current = true;
      if (AppState.currentState === 'active') {
        accumRef.current.onActive(Date.now());
      }
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
        // Resume is never an interstitial opportunity.
        accumRef.current.onActive(now);
        return;
      }
      const total = accumRef.current.onInactive(now);
      void persistForegroundActiveMs(total);
    };

    const sub = AppState.addEventListener('change', onAppState);
    const interval = setInterval(() => {
      if (AppState.currentState === 'active' && readyRef.current) {
        persist(Date.now());
      }
    }, 30_000);

    return () => {
      sub.remove();
      clearInterval(interval);
      if (AppState.currentState === 'active') {
        persist(Date.now());
      }
    };
  }, []);

  useEffect(() => {
    const onOpportunity = (req: InterstitialOpportunityRequest) => {
      if (presentingRef.current) return;
      if (!flags.automaticInterstitialEnabled) return;

      let units: ReturnType<typeof resolveAdUnitConfig> | null = null;
      try {
        units = resolveAdUnitConfig();
      } catch {
        return;
      }
      if (!units.interstitialUnitId) return;

      const offline = services.network.isOffline();
      const consent = services.ads.getConsentState();
      const foregroundActiveMs = accumRef.current.flush(Date.now());

      presentingRef.current = true;
      void tryPresentInterstitial({
        automaticInterstitialEnabled: flags.automaticInterstitialEnabled,
        hasSubscription: req.hasSubscription ?? false,
        earnedAdFreeUntilMs: entitlement?.earnedAdFreeUntilMs ?? null,
        trustedNowMs: entitlement?.trustedNow() ?? null,
        offline,
        canRequestAds: consent.canRequestAds,
        appActive: AppState.currentState === 'active',
        modalVisible: req.modalVisible,
        keyboardVisible: req.keyboardVisible,
        listening: req.listening,
        speaking: req.speaking,
        translating: req.translating,
        resultUnderReview: req.resultUnderReview,
        cameraActive: req.cameraActive,
        transition: req.transition,
        surface: req.surface,
        foregroundActiveMs,
        adapter: services.ads.adapter,
        interstitialUnitId: units.interstitialUnitId,
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
  }, [entitlement, flags.automaticInterstitialEnabled, services]);

  return null;
}
