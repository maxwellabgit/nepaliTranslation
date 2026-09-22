import { useEffect, type ReactNode } from 'react';
import {
  SafeAreaProvider,
  type Metrics,
} from 'react-native-safe-area-context';
import { AuthProvider } from '../features/auth/AuthProvider';
import { AuthStatusBanner } from '../features/auth/AuthStatusBanner';
import { StartupConsentGate } from '../features/auth/StartupConsentGate';
import { EntitlementProvider } from '../features/entitlements/EntitlementProvider';
import { SubscriptionProvider } from '../features/subscription/SubscriptionProvider';
import { migrateLegacyReviewQueue } from '../storage/contributionOutbox';
import { ServiceProvider } from '../services/ServiceContext';
import type { AppServices } from '../services/contracts';
import { RuntimeProvider } from '../runtime/RuntimeContext';
import type { RuntimePorts } from '../runtime/ports';
import { ThemeProvider } from '../theme';
import { UiLangProvider } from '../i18n';
import { FeatureConfigProvider } from './FeatureConfigProvider';
import { LifecycleCoordinator } from './LifecycleCoordinator';
import { InterstitialController } from '../features/ads/InterstitialController';

/** Jest never emits native safe-area events; seed metrics so children mount. */
const INITIAL_SAFE_AREA: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

type Props = {
  children: ReactNode;
  /** Injected fakes for production-composition tests. */
  services?: AppServices;
  /** Device/runtime ports (STT, TTS, MT, OCR, clock). */
  runtime?: RuntimePorts;
  /**
   * Test seam — skip the G2 startup consent gate when true so integration
   * tests reach product screens without acknowledging T&C/Privacy/18+.
   */
  bypassStartupConsent?: boolean;
};

function LegacyOutboxMigration() {
  useEffect(() => {
    void migrateLegacyReviewQueue();
  }, []);
  return null;
}

/** Optional identity + entitlements + services. Missing Supabase leaves children usable. */
export function AppProviders({
  children,
  services,
  runtime,
  bypassStartupConsent,
}: Props) {
  return (
    <SafeAreaProvider initialMetrics={INITIAL_SAFE_AREA}>
      <ThemeProvider>
        <ServiceProvider services={services}>
          <UiLangProvider>
          <RuntimeProvider runtime={runtime}>
            <AuthProvider>
              <EntitlementProvider>
                <FeatureConfigProvider>
                  <SubscriptionProvider>
                  <LegacyOutboxMigration />
                  <LifecycleCoordinator />
                  <InterstitialController />
                  <AuthStatusBanner />
                  <StartupConsentGate initialAcknowledged={bypassStartupConsent}>
                    {children}
                  </StartupConsentGate>
                  </SubscriptionProvider>
                </FeatureConfigProvider>
              </EntitlementProvider>
            </AuthProvider>
          </RuntimeProvider>
          </UiLangProvider>
        </ServiceProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
