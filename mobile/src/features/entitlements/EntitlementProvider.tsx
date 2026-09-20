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
import { getSupabase } from '../../services/supabase';

import {
  clearCachedEntitlement,
  loadCachedEntitlement,
  saveCachedEntitlement,
  type CachedEntitlement,
} from './entitlementCache';
import {
  measureServerOffset,
  trustedNowMs,
  type TrustedClock,
} from './trustedTime';

type EntitlementState = {
  ready: boolean;
  earnedAdFreeUntilMs: number | null;
  lifetimeCredits: number;
  version: number;
  /** True when earned window is still ahead of trusted now. */
  hasActiveEarnedAdFree: () => boolean;
  /** Null until a successful server_time sync in this process. */
  trustedNow: () => number | null;
  refresh: () => Promise<void>;
};

const EntitlementContext = createContext<EntitlementState | null>(null);

const EMPTY: CachedEntitlement = {
  earnedAdFreeUntilMs: null,
  lifetimeCredits: 0,
  version: 0,
  syncedAtMs: 0,
};

function monoNow(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return 0;
}

function readTrustedNow(clock: TrustedClock | null): number | null {
  if (!clock) return null;
  return trustedNowMs(Date.now(), clock, monoNow());
}

export function EntitlementProvider({ children }: { children: ReactNode }) {
  const { status, userId } = useAuth();
  const [cache, setCache] = useState<CachedEntitlement>(EMPTY);
  // In-process only — never restore monoAtSyncMs across restarts (it resets).
  const [clock, setClock] = useState<TrustedClock | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    if (status !== 'signed-in' || !userId) {
      setCache(EMPTY);
      setClock(null);
      await clearCachedEntitlement();
      setReady(true);
      return;
    }
    const client = getSupabase();
    if (!client) {
      const local = await loadCachedEntitlement();
      if (local) setCache(local);
      // Keep clock null offline — cannot claim ad-free without server time.
      setReady(true);
      return;
    }
    try {
      const deviceNow = Date.now();
      const mono = monoNow();
      const [entRes, timeRes] = await Promise.all([
        client
          .from('earned_entitlements')
          .select('earned_ad_free_until, lifetime_credits, version')
          .eq('user_id', userId)
          .maybeSingle(),
        client.rpc('server_time'),
      ]);
      if (entRes.error) throw entRes.error;
      const data = entRes.data;
      if (timeRes.error || timeRes.data == null) {
        const local = await loadCachedEntitlement();
        if (local) setCache(local);
        setReady(true);
        return;
      }
      const parsed = Date.parse(String(timeRes.data));
      if (!Number.isFinite(parsed)) {
        const local = await loadCachedEntitlement();
        if (local) setCache(local);
        setReady(true);
        return;
      }
      const nextClock = measureServerOffset(deviceNow, parsed, mono);
      setClock(nextClock);
      const until = data?.earned_ad_free_until
        ? Date.parse(String(data.earned_ad_free_until))
        : null;
      const next: CachedEntitlement = {
        earnedAdFreeUntilMs: Number.isFinite(until) ? until : null,
        lifetimeCredits: data?.lifetime_credits ?? 0,
        version: data?.version ?? 0,
        syncedAtMs: deviceNow,
      };
      setCache(next);
      await saveCachedEntitlement(next);
    } catch {
      const local = await loadCachedEntitlement();
      if (local) setCache(local);
    } finally {
      setReady(true);
    }
  }, [status, userId]);

  useEffect(() => {
    void (async () => {
      const local = await loadCachedEntitlement();
      if (local) setCache(local);
      await refresh();
    })();
  }, [refresh]);

  const value = useMemo<EntitlementState>(() => {
    const expiry = cache.earnedAdFreeUntilMs;
    return {
      ready,
      earnedAdFreeUntilMs: expiry,
      lifetimeCredits: cache.lifetimeCredits,
      version: cache.version,
      hasActiveEarnedAdFree: () => {
        const now = readTrustedNow(clock);
        if (now === null || expiry === null) return false;
        return expiry > now;
      },
      trustedNow: () => readTrustedNow(clock),
      refresh,
    };
  }, [cache, clock, ready, refresh]);

  return (
    <EntitlementContext.Provider value={value}>
      {children}
    </EntitlementContext.Provider>
  );
}

export function useEntitlement(): EntitlementState {
  const ctx = useContext(EntitlementContext);
  if (!ctx) {
    throw new Error('useEntitlement must be used within EntitlementProvider');
  }
  return ctx;
}
