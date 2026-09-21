import { useEffect, type ReactNode } from 'react';
import {
  SafeAreaProvider,
  type Metrics,
} from 'react-native-safe-area-context';
import { AuthProvider } from '../features/auth/AuthProvider';
import { AuthStatusBanner } from '../features/auth/AuthStatusBanner';
import { EntitlementProvider } from '../features/entitlements/EntitlementProvider';
import { migrateLegacyReviewQueue } from '../storage/contributionOutbox';
import { ServiceProvider } from '../services/ServiceContext';
import type { AppServices } from '../services/contracts';
import { FeatureConfigProvider } from './FeatureConfigProvider';
import { LifecycleCoordinator } from './LifecycleCoordinator';

/** Jest never emits native safe-area events; seed metrics so children mount. */
const INITIAL_SAFE_AREA: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

type Props = {
  children: ReactNode;
  /** Injected fakes for production-composition tests. */
  services?: AppServices;
};

function LegacyOutboxMigration() {
  useEffect(() => {
    void migrateLegacyReviewQueue();
  }, []);
  return null;
}

/** Optional identity + entitlements + services. Missing Supabase leaves children usable. */
export function AppProviders({ children, services }: Props) {
  return (
    <SafeAreaProvider initialMetrics={INITIAL_SAFE_AREA}>
      <ServiceProvider services={services}>
        <AuthProvider>
          <EntitlementProvider>
            <FeatureConfigProvider>
              <LegacyOutboxMigration />
              <LifecycleCoordinator />
              <AuthStatusBanner />
              {children}
            </FeatureConfigProvider>
          </EntitlementProvider>
        </AuthProvider>
      </ServiceProvider>
    </SafeAreaProvider>
  );
}
