import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';
import * as Network from 'expo-network';
import { AppState } from 'react-native';
import { authReducer, INITIAL_AUTH, type AuthState } from './authPolicy';
import { mirrorStoredStartupConsent } from './recordStartupConsent';
import { sessionInactiveNow, touchSessionActivity } from './sessionExpiry';
import { clearLocalConsent, loadLocalConsent } from '../../storage/contributionConsent';
import { saveSharingToggles } from '../../storage/sharingToggles';
import { bindAuthRefresh, getSupabase } from '../../services/supabase';
import { readPublicEnv } from '../../config/env';
import { fetchAccountSummary } from './accountSummary';
import { performAccountDeletion } from './deleteAccount';
import { ensurePrivateIdentity, readKnownPrivateIdentity } from './guestIdentity';
import { loadPendingDeletion, markPendingDeletionComplete, isServerDeletionComplete, savePendingDeletionDue } from '../../storage/pendingDeletion';

type AuthContextValue = AuthState & {
  authConfigured: boolean;
  ensureGuestIdentity: () => Promise<boolean>;
  retryIdentity: () => Promise<boolean>;
  deleteData: () => Promise<void>;
  refreshDataSummary: () => Promise<void>;
  /** Internal compatibility aliases; no account UI. */
  deleteAccount: () => Promise<void>;
  refreshAccountSummary: () => Promise<void>;
  clearAlert: () => void;
};
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, INITIAL_AUTH);
  const authConfigured = readPublicEnv().authConfigured;
  const stateRef = useRef(state);
  stateRef.current = state;
  const mounted = useRef(true);
  const deleting = useRef(false);
  const deleteRequest = useRef(false);
  const generation = useRef(0);
  const retryDeletion = useRef<() => Promise<void>>(async () => undefined);
  const ensureGuestIdentity = useCallback(async () => {
    try {
    const client = getSupabase();
    if (deleting.current) return false;
    const version = generation.current;
    const userId = client ? await ensurePrivateIdentity(client) : null;
    if (!mounted.current || version !== generation.current || deleting.current) return false;
    if (!userId) {
      dispatch({ type: 'identity_unavailable' });
      const known = await readKnownPrivateIdentity();
      if (mounted.current && version === generation.current && known) dispatch({ type: 'local_identity', userId: known });
      const pending = known ? await loadPendingDeletion(known) : null;
      if (mounted.current && version === generation.current && known && pending && !pending.completedAt) {
        dispatch({ type: 'local_deletion', userId: known, dueAt: pending.dueAt,
          pending: !pending.completedAt && !pending.dueAt, completedAt: pending.completedAt });
      }
      return false;
    }
    if (await sessionInactiveNow(userId)) {
      await clearLocalConsent(userId);
      await saveSharingToggles(userId, { speech: false, photos: false });
      if (mounted.current && version === generation.current) dispatch({ type: 'permissions_revoked' });
    }
    await touchSessionActivity(userId);
    if (!mounted.current || version !== generation.current || deleting.current) return false;
    dispatch({ type: 'ready_session', userId });
    const local = await loadPendingDeletion(userId);
    if (mounted.current && version === generation.current && local && !local.completedAt) {
      dispatch({ type: 'local_deletion', userId, dueAt: local.dueAt,
        pending: !local.completedAt && !local.dueAt, completedAt: local.completedAt });
    }
    void mirrorStoredStartupConsent();
    return true;
    } catch {
      if (mounted.current) dispatch({ type: 'identity_unavailable' });
      return false;
    }
  }, []);

  const refreshDataSummary = useCallback(async () => {
    try {
    const subject = stateRef.current.userId;
    const version = generation.current;
    if (!subject) return;
    const result = await fetchAccountSummary(subject);
    if (!mounted.current || !result.ok || stateRef.current.userId !== subject || version !== generation.current) return;
    if (isServerDeletionComplete(result.summary.deletionCompletedAt)) {
      await markPendingDeletionComplete(subject, result.summary.deletionCompletedAt!);
    }
    const local = await loadPendingDeletion(subject);
    if (!mounted.current || stateRef.current.userId !== subject || version !== generation.current) return;
    const pending = local && !local.completedAt;
    if (pending) {
      dispatch({ type: 'local_deletion', userId: subject, dueAt: local.dueAt,
        pending: !local.dueAt, completedAt: null });
      return;
    }
    if (!mounted.current || stateRef.current.userId !== subject || version !== generation.current) return;
    const permission = await loadLocalConsent(subject);
    if (!mounted.current || stateRef.current.userId !== subject || version !== generation.current) return;
    dispatch({ type: 'account_summary', consentVersion: permission?.consent_version === result.summary.consentVersion ? result.summary.consentVersion : null,
      ageConfirmed: Boolean(permission?.age_confirmed && result.summary.ageConfirmed), deletionDueAt: result.summary.deletionDueAt,
      deletionCompletedAt: result.summary.deletionCompletedAt });
    } catch { /* Keep local deletion intent and deny stale permission updates. */ }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const client = getSupabase();
    if (client) bindAuthRefresh(client);
    const resume = async () => {
      const ready = await ensureGuestIdentity();
      if (!ready || !mounted.current) return;
      const owner = await readKnownPrivateIdentity();
      const pending = owner ? await loadPendingDeletion(owner) : null;
      if (!mounted.current) return;
      if (pending && !pending.dueAt && !pending.completedAt) await retryDeletion.current();
      else void refreshDataSummary();
    };
    void resume().catch(() => undefined);
    // Events invalidate stale permission summaries; they do not create identities.
    const subscription = client?.auth.onAuthStateChange((event, session) => {
      if (!mounted.current || deleting.current) return;
      if (!session && (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED')) {
        generation.current += 1;
        dispatch({ type: 'identity_unavailable' });
      } else if (event !== 'SIGNED_IN' && session?.user && stateRef.current.userId && session.user.id !== stateRef.current.userId) {
        generation.current += 1;
        dispatch({ type: 'identity_unavailable' });
      }
    });
    const foreground = AppState.addEventListener('change', (next) => {
      if (next === 'active') void resume().catch(() => undefined);
    });
    const connection = Network.addNetworkStateListener((next) => {
      if (next.isConnected === true && next.isInternetReachable !== false) void resume().catch(() => undefined);
    });
    return () => {
      mounted.current = false;
      generation.current += 1;
      subscription?.data.subscription.unsubscribe();
      foreground.remove();
      connection.remove();
    };
  }, [ensureGuestIdentity, refreshDataSummary]);
  useEffect(() => {
    if (state.status === 'signed-in' && state.userId) void refreshDataSummary();
  }, [state.status, state.userId, refreshDataSummary]);

  const deleteData = useCallback(async () => {
    if (deleteRequest.current) return;
    deleteRequest.current = true;
    const userId = stateRef.current.userId ?? await readKnownPrivateIdentity();
    if (!userId) { deleteRequest.current = false; return; }
    deleting.current = true;
    generation.current += 1;
    dispatch({ type: 'start_deletion' });
    try {
      const result = await performAccountDeletion({ userId });
      if (!mounted.current) return;
      if (!result.ok) {
        dispatch({ type: 'deletion_paused', message: result.message });
        return;
      }
      if (result.scheduled && result.deletionDueAt) {
        await savePendingDeletionDue(userId, result.deletionDueAt);
        // Retain JWT/subject for deletion status and retry; never rotate while pending.
        dispatch({ type: 'deletion_scheduled', deletionDueAt: result.deletionDueAt,
          message: 'Data deletion requested. The deadline appears below.' });
      } else {
        dispatch({ type: 'deletion_paused', message: 'The shared-data deletion deadline could not be confirmed. Retry when connected.' });
      }
    } catch {
      dispatch({ type: 'deletion_paused', message: 'Data deletion could not finish. Retry when connected.' });
    } finally { deleting.current = false; deleteRequest.current = false; }
  }, []);

  retryDeletion.current = deleteData;

  const value = useMemo<AuthContextValue>(() => ({ ...state, authConfigured, ensureGuestIdentity,
    retryIdentity: ensureGuestIdentity, deleteData, refreshDataSummary,
    deleteAccount: deleteData, refreshAccountSummary: refreshDataSummary,
    clearAlert: () => dispatch({ type: 'dismiss_alert' }),
  }), [state, authConfigured, ensureGuestIdentity, deleteData, refreshDataSummary]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  return context ?? { ...INITIAL_AUTH, status: 'guest', authConfigured: false,
    ensureGuestIdentity: async () => false, retryIdentity: async () => false,
    deleteData: async () => undefined, refreshDataSummary: async () => undefined,
    deleteAccount: async () => undefined, refreshAccountSummary: async () => undefined,
    clearAlert: () => undefined };
}
