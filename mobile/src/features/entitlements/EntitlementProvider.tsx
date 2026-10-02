import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { grantLocalAdCredits } from '../contribution/dailyOpen';
import { useAuth } from '../auth/AuthProvider';
import { getSupabase } from '../../services/supabase';
import {
  loadProvisionalGrant,
  provisionalEarnedUntilMs,
  reconcileProvisional,
  saveProvisionalGrant,
  type ProvisionalGrant,
} from '../ads/provisionalGrant';

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
  durableAdFreeUntilMs?: number | null;
  /** Effective ad-free until: max(server earned, provisional local). */
  earnedAdFreeUntilMs: number | null;
  lifetimeCredits: number;
  version: number;
  /** True when earned window is still ahead of trusted now (or provisional device now). */
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
  const [nowMs, setNowMs] = useState(() => Date.now());
  const { status, userId } = useAuth();
  const [cache, setCache] = useState<CachedEntitlement>(EMPTY);
  // In-process only — never restore monoAtSyncMs across restarts (it resets).
  const [clock, setClock] = useState<TrustedClock | null>(null);
  const [provisional, setProvisional] = useState<ProvisionalGrant | null>(null);
  useEffect(() => {
    if (!provisional) return;
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [provisional]);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    if (status !== 'signed-in' || !userId) {
      setCache(EMPTY);
      setClock(null);
      setProvisional(null);
      await clearCachedEntitlement();
      await saveProvisionalGrant(null);
      setReady(true);
      return;
    }

    let localProv = await loadProvisionalGrant();
    if (localProv?.userId && localProv.userId !== userId) localProv = null;
    await saveProvisionalGrant(localProv);

    const client = getSupabase();
    if (!client) {
      const local = await loadCachedEntitlement();
      if (local) setCache(local);
      setProvisional(localProv);
      // Keep clock null offline — cannot claim server ad-free without server time.
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
        setProvisional(localProv);
        setReady(true);
        return;
      }
      const parsed = Date.parse(String(timeRes.data));
      if (!Number.isFinite(parsed)) {
        const local = await loadCachedEntitlement();
        if (local) setCache(local);
        setProvisional(localProv);
        setReady(true);
        return;
      }
      const nextClock = measureServerOffset(deviceNow, parsed, mono);
      setClock(nextClock);
      const until = data?.earned_ad_free_until
        ? Date.parse(String(data.earned_ad_free_until))
        : null;
      const serverUntil = Number.isFinite(until) ? until : null;

      // Only this authenticated session's consumed SSV receipt can commit local stacking.
      if (localProv && localProv.userId === userId) {
        const receipt = await client.rpc('rewarded_session_verified', { p_session_token: localProv.sessionToken });
        if (!receipt.error && receipt.data === true) {
          await grantLocalAdCredits(2, deviceNow, localProv.durableUntilMs ?? null,
            `${userId}:${localProv.sessionToken}`);
          localProv = null;
          await saveProvisionalGrant(null);
        }
      }

      const next: CachedEntitlement = {
        earnedAdFreeUntilMs: serverUntil,
        lifetimeCredits: data?.lifetime_credits ?? 0,
        version: data?.version ?? 0,
        syncedAtMs: deviceNow,
      };
      setCache(next);
      setProvisional(localProv);
      await saveCachedEntitlement(next);
    } catch {
      const local = await loadCachedEntitlement();
      if (local) setCache(local);
      setProvisional(localProv);
    } finally {
      setReady(true);
    }
  }, [status, userId]);

  useEffect(() => {
    void (async () => {
      const local = await loadCachedEntitlement();
      if (local) setCache(local);
      const prov = await loadProvisionalGrant();
      if (prov) setProvisional(reconcileProvisional(prov, Date.now()));
      await refresh();
    })();
  }, [refresh]);

  useEffect(() => {
    if (!provisional || status !== 'signed-in') return;
    // SSV often arrives after CLOSED; retry the exact receipt without replaying animation.
    const timer = setInterval(() => { void refresh(); }, 30_000);
    return () => clearInterval(timer);
  }, [provisional, refresh, status]);

  const value = useMemo<EntitlementState>(() => {
    const serverExpiry = cache.earnedAdFreeUntilMs;
    const provisionalUntil = provisionalEarnedUntilMs(provisional, nowMs);
    const combinedUntil =
      serverExpiry == null
        ? provisionalUntil
        : provisionalUntil == null
          ? serverExpiry
          : Math.max(serverExpiry, provisionalUntil);
    return {
      ready,
      durableAdFreeUntilMs: serverExpiry,
      earnedAdFreeUntilMs: combinedUntil,
      lifetimeCredits: cache.lifetimeCredits,
      version: cache.version,
      hasActiveEarnedAdFree: () => {
        const now = Date.now();
        const provActive = provisionalEarnedUntilMs(provisional, now);
        if (provActive != null && provActive > now) return true;
        const trusted = readTrustedNow(clock);
        if (trusted == null || serverExpiry == null) return false;
        return serverExpiry > trusted;
      },
      trustedNow: () => readTrustedNow(clock),
      refresh,
    };
  }, [cache, clock, provisional, ready, refresh, nowMs]);

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

/** Soft-fail for screens that may render outside the provider in unit tests. */
export function useEntitlementOptional(): EntitlementState | null {
  return useContext(EntitlementContext);
}
