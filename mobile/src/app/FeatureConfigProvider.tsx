import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';
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
const RefreshFeatureConfigContext = createContext<() => Promise<void>>(async () => undefined);

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
  const { featureConfig, network } = useServices();
  const mounted = useRef(true);
  const request = useRef(0);
  const [flags, setFlags] = useState<FeatureFlags>(() => {
    const initial = {
      ...DEFAULT_FEATURE_FLAGS,
      learnEnabled: true,
      ...readTgFeatureFlags(),
    };
    setRuntimeFeatureFlags(initial);
    return initial;
  });

  const refresh = useCallback(async () => {
    const id = ++request.current;
    let next: Partial<FeatureFlags> = {};
    try { next = await featureConfig.loadFlags(); } catch { /* fail closed */ }
    if (!mounted.current || id !== request.current) return;
    const merged = { ...DEFAULT_FEATURE_FLAGS, ...next, ...readTgFeatureFlags(), learnEnabled: true };
    setRuntimeFeatureFlags(merged);
    setFlags(merged);
  }, [featureConfig]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const foreground = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    const unsubscribe = network.subscribe((offline) => {
      if (!offline) void refresh();
    });
    return () => {
      mounted.current = false;
      foreground.remove();
      unsubscribe();
    };
  }, [network, refresh]);

  return (
    <FeatureConfigContext.Provider value={flags}>
      <RefreshFeatureConfigContext.Provider value={refresh}>
      {children}
      </RefreshFeatureConfigContext.Provider>
    </FeatureConfigContext.Provider>
  );
}

/** Settings can retry a startup failure without restarting the app. */
export function useRefreshFeatureFlags(): () => Promise<void> {
  return useContext(RefreshFeatureConfigContext);
}

export function useFeatureFlags(): FeatureFlags {
  return useContext(FeatureConfigContext);
}
