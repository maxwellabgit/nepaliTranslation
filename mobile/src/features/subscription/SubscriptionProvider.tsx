import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { useAuth } from '../auth/AuthProvider';
import { useFeatureFlags } from '../../app/FeatureConfigProvider';
import { useServices } from '../../services/ServiceContext';
import { PaywallSheet } from './PaywallSheet';
import {
  EMPTY_SUBSCRIPTION,
  hasActiveSubscription,
  type SubscriptionSnapshot,
} from './purchaseTypes';

type SubscriptionState = {
  ready: boolean;
  snapshot: SubscriptionSnapshot;
  /** True when paid ad-free is currently effective (checked at call time). */
  hasSubscription: () => boolean;
  priceString: string | null;
  paywallEnabled: boolean;
  refresh: () => Promise<void>;
  purchase: () => Promise<{ ok: boolean; reason?: string }>;
  restore: () => Promise<{ ok: boolean; reason?: string }>;
  manage: () => Promise<void>;
  openPaywall: () => void;
  closePaywall: () => void;
};

const SubscriptionContext = createContext<SubscriptionState | null>(null);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const flags = useFeatureFlags();
  const { purchases } = useServices();
  const [snapshot, setSnapshot] = useState<SubscriptionSnapshot>(
    EMPTY_SUBSCRIPTION,
  );
  const [priceString, setPriceString] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);

  const refresh = useCallback(async () => {
    await purchases.configure();
    const snap = await purchases.refresh(
      auth.status === 'signed-in' ? auth.userId : null,
    );
    setSnapshot(snap);
    const price =
      snap.priceString ?? (await purchases.getOfferPriceString());
    setPriceString(price);
    setReady(true);
  }, [auth.status, auth.userId, purchases]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openPaywall = useCallback(() => {
    if (!flags.paywallEnabled) return;
    setPaywallOpen(true);
  }, [flags.paywallEnabled]);

  const closePaywall = useCallback(() => {
    setPaywallOpen(false);
  }, []);

  const value = useMemo<SubscriptionState>(() => {
    return {
      ready,
      snapshot,
      hasSubscription: () => hasActiveSubscription(snapshot, Date.now()),
      priceString,
      paywallEnabled: flags.paywallEnabled,
      refresh,
      purchase: async () => {
        const result = await purchases.purchase();
        if (result.ok) {
          setSnapshot(result.snapshot);
          setPriceString(result.snapshot.priceString);
          return { ok: true };
        }
        return { ok: false, reason: result.reason };
      },
      restore: async () => {
        const result = await purchases.restore();
        if (result.ok) {
          setSnapshot(result.snapshot);
          setPriceString(result.snapshot.priceString);
          return { ok: true };
        }
        return { ok: false, reason: result.reason };
      },
      manage: () => purchases.manage(),
      openPaywall,
      closePaywall,
    };
  }, [
    closePaywall,
    flags.paywallEnabled,
    openPaywall,
    priceString,
    purchases,
    ready,
    refresh,
    snapshot,
  ]);

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
      <PaywallSheet visible={paywallOpen} onClose={closePaywall} />
    </SubscriptionContext.Provider>
  );
}

export function useSubscription(): SubscriptionState {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    throw new Error('useSubscription requires SubscriptionProvider');
  }
  return ctx;
}

export function useSubscriptionOptional(): SubscriptionState | null {
  return useContext(SubscriptionContext);
}
