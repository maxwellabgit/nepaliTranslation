import { useEffect, useState } from 'react';
import { AppProviders } from './src/app/AppProviders';
import { AppShell } from './src/app/AppShell';
import { TranslateScreen } from './src/screens/TranslateScreen';
import { CameraScreen } from './src/screens/CameraScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { LearnScreen } from './src/screens/LearnScreen';
import { ReviewScreen } from './src/screens/ReviewScreen';
import { sharedTranslationEngine } from './src/mt/TranslationEngine';
import {
  MT_WARM_DOWNLOADING,
  MT_WARM_FAILED,
  MT_WARM_PREPARING,
} from './src/mt/mtStatus';
import type { AppServices } from './src/services/contracts';
import { createProductionServices } from './src/services/productionServices';
import type { RuntimePorts } from './src/runtime/ports';
import { resolveBootRuntime } from './src/runtime/resolveBootRuntime';
import { resolveBootServices } from './src/runtime/resolveBootServices';

export type NepTranslateAppProps = {
  /** Test-only service injection. Production default supplies real adapters. */
  services?: AppServices;
  /** Deterministic device/runtime ports for tests and the Windows harness. */
  runtime?: RuntimePorts;
  /** Skip MT warm-up in integration tests when the engine is already mocked. */
  skipWarmUp?: boolean;
  /**
   * Test seam: skip the G2 startup consent gate so integration tests reach
   * product surfaces without acknowledging T&C / Privacy / 18+. Production
   * boot must leave this false so the gate is enforced.
   */
  bypassStartupConsent?: boolean;
};

/**
 * Real composition root: providers + AppShell + production screens.
 * Default export supplies production services for Expo registration.
 */
export function NepTranslateApp({
  services,
  runtime,
  skipWarmUp = false,
  bypassStartupConsent = false,
}: NepTranslateAppProps = {}) {
  const [neuralReady, setNeuralReady] = useState(false);
  const [mtWarmStatus, setMtWarmStatus] = useState<string | null>(
    skipWarmUp ? null : MT_WARM_PREPARING,
  );

  useEffect(() => {
    if (skipWarmUp) {
      setNeuralReady(sharedTranslationEngine.isNeuralReady());
      setMtWarmStatus(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      setMtWarmStatus(MT_WARM_PREPARING);
      await sharedTranslationEngine.warmUp((p) => {
        if (cancelled) return;
        if (p.phase === 'download') {
          setMtWarmStatus(`${MT_WARM_DOWNLOADING} ${p.index}/${p.total}`);
        } else {
          setMtWarmStatus(MT_WARM_PREPARING);
        }
      });
      if (cancelled) return;
      const ready = sharedTranslationEngine.isNeuralReady();
      setNeuralReady(ready);
      if (!ready) {
        setMtWarmStatus(MT_WARM_FAILED);
        setTimeout(() => {
          if (!cancelled) setMtWarmStatus(null);
        }, 4000);
      } else {
        setMtWarmStatus(null);
      }
      await sharedTranslationEngine.whenReverseSettled();
      if (!cancelled && ready) setMtWarmStatus(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [skipWarmUp]);

  return (
    <AppProviders
      services={services}
      runtime={runtime}
      bypassStartupConsent={bypassStartupConsent}
    >
      <AppShell
        neuralReady={neuralReady}
        mtWarmStatus={mtWarmStatus}
        TranslatePane={(props) => <TranslateScreen {...props} />}
        CameraPane={() => <CameraScreen active />}
        LearnPane={(props) => <LearnScreen {...props} />}
        HistoryOverlay={(props) => <HistoryScreen {...props} />}
        SettingsOverlay={(props) => <SettingsScreen {...props} />}
        TodaysReviewOverlay={(props) => <ReviewScreen {...props} />}
      />
    </AppProviders>
  );
}

export default function App() {
  const harnessRuntime = resolveBootRuntime();
  const boot =
    typeof window !== 'undefined'
      ? (
          window as unknown as {
            __NEPTRANSLATE_TG__?: {
              harness?: string;
              offline?: boolean;
              featureFlags?: Record<string, boolean>;
              iapSoftFail?: boolean;
              authConfigured?: boolean;
              canRequestAds?: boolean;
              acknowledgeStartupConsent?: 'auto-accept' | 'require';
            };
          }
        ).__NEPTRANSLATE_TG__
      : undefined;
  const inHarness = boot?.harness === 'neptranslate-testing-ground';
  const harnessServices = inHarness ? resolveBootServices() : undefined;
  // Only the testing-ground harness can request a bypass of the G2 startup
  // consent gate. Production Expo bundles never receive
  // `__NEPTRANSLATE_TG__` and therefore always render the real gate.
  const bypassStartupConsent =
    inHarness && boot?.acknowledgeStartupConsent === 'auto-accept';
  return (
    <NepTranslateApp
      services={harnessServices ?? createProductionServices()}
      runtime={harnessRuntime}
      skipWarmUp={Boolean(harnessRuntime)}
      bypassStartupConsent={bypassStartupConsent}
    />
  );
}
