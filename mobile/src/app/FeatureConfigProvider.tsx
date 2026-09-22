import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  DEFAULT_FEATURE_FLAGS,
  setRuntimeFeatureFlags,
  type FeatureFlags,
} from './featureFlags';
import { useServices } from '../services/ServiceContext';

const FeatureConfigContext = createContext<FeatureFlags>({
  ...DEFAULT_FEATURE_FLAGS,
  learnEnabled: true,
});

/**
 * Loads flags via FeatureConfigService. Learn stays available on failure.
 * Contributions/rewards/ads/paywall/telemetry stay off unless the service enables them.
 */
export function FeatureConfigProvider({ children }: { children: ReactNode }) {
  const { featureConfig } = useServices();
  const [flags, setFlags] = useState<FeatureFlags>({
    ...DEFAULT_FEATURE_FLAGS,
    learnEnabled: true,
  });

  useEffect(() => {
    let cancelled = false;
    void featureConfig
      .loadFlags()
      .then((next) => {
        if (cancelled) return;
        const merged = { ...DEFAULT_FEATURE_FLAGS, ...next, learnEnabled: true };
        setRuntimeFeatureFlags(merged);
        setFlags(merged);
      })
      .catch(() => {
        if (cancelled) return;
        const fallback = { ...DEFAULT_FEATURE_FLAGS, learnEnabled: true };
        setRuntimeFeatureFlags(fallback);
        setFlags(fallback);
      });
    return () => {
      cancelled = true;
    };
  }, [featureConfig]);

  return (
    <FeatureConfigContext.Provider value={flags}>
      {children}
    </FeatureConfigContext.Provider>
  );
}

export function useFeatureFlags(): FeatureFlags {
  return useContext(FeatureConfigContext);
}
