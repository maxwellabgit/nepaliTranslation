import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useAuth } from '../features/auth/AuthProvider';
import { useEntitlement } from '../features/entitlements/EntitlementProvider';
import { useServices } from '../services/ServiceContext';

export type LifecycleHooks = {
  onOutboxFlush?: () => void;
  onEntitlementRefresh?: () => void;
  onOnline?: () => void;
  onForeground?: () => void;
};

/**
 * Single coordinator for auth / foreground / connectivity.
 * H2 attaches outbox flush; entitlement refresh is hooked now as a no-op-safe call.
 */
export function LifecycleCoordinator({
  hooks,
}: {
  hooks?: LifecycleHooks;
} = {}) {
  const { status } = useAuth();
  const entitlements = useEntitlement();
  const { network, contribution, entitlement } = useServices();
  const wasOffline = useRef(network.isOffline());
  const hooksRef = useRef(hooks);
  hooksRef.current = hooks;

  useEffect(() => {
    const runForeground = () => {
      hooksRef.current?.onForeground?.();
      hooksRef.current?.onOutboxFlush?.();
      hooksRef.current?.onEntitlementRefresh?.();
      void contribution.flushOutbox();
      void entitlement.refresh();
      void entitlements.refresh();
    };

    const onAppState = (next: AppStateStatus) => {
      if (next === 'active') runForeground();
    };
    const sub = AppState.addEventListener('change', onAppState);
    // Cold launch after providers are ready.
    runForeground();
    return () => sub.remove();
  }, [contribution, entitlement, entitlements]);

  useEffect(() => {
    return network.subscribe((offline) => {
      if (wasOffline.current && !offline) {
        hooksRef.current?.onOnline?.();
        hooksRef.current?.onOutboxFlush?.();
        void contribution.flushOutbox();
      }
      wasOffline.current = offline;
    });
  }, [network, contribution]);

  useEffect(() => {
    if (status === 'signed-in') {
      hooksRef.current?.onOutboxFlush?.();
      void contribution.flushOutbox();
      void entitlements.refresh();
    }
  }, [status, contribution, entitlements]);

  return null;
}
