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

/** Testing-ground only: synchronous flag overrides from window boot config. */
function readTgFeatureFlags(): Partial<FeatureFlags> {
  if (typeof window === 'undefined') return {};
  const boot = (
    window as unknown as {
      __NEPTRANSLATE_TG__?: {
        harness?: string;
        featureFlags?: Partial<FeatureFlags>;
      };
    }
  ).__NEPTRANSLATE_TG__;
  if (!boot || boot.harness !== 'neptranslate-testing-ground') return {};
  return boot.featureFlags ?? {};
}

/**
 * Loads flags via FeatureConfigService. Learn stays available on failure.
 * Contributions/rewards/ads/paywall/telemetry stay off unless the service enables them.
 */
export function FeatureConfigProvider({ children }: { children: ReactNode }) {
  const { featureConfig } = useServices();
  const [flags, setFlags] = useState<FeatureFlags>(() => {
    const initial = {
      ...DEFAULT_FEATURE_FLAGS,
      learnEnabled: true,
      ...readTgFeatureFlags(),
    };
    setRuntimeFeatureFlags(initial);
    return initial;
  });

  useEffect(() => {
    let cancelled = false;
    void featureConfig
      .loadFlags()
      .then((next) => {
        if (cancelled) return;
        const tg = readTgFeatureFlags();
        const merged = {
          ...DEFAULT_FEATURE_FLAGS,
          ...next,
          ...tg,
          learnEnabled: true,
        };
        setRuntimeFeatureFlags(merged);
        setFlags(merged);
      })
      .catch(() => {
        if (cancelled) return;
        const tg = readTgFeatureFlags();
        const fallback = {
          ...DEFAULT_FEATURE_FLAGS,
          ...tg,
          learnEnabled: true,
        };
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
