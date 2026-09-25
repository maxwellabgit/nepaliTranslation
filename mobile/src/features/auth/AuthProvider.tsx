import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import * as AppleAuthentication from 'expo-apple-authentication';
import {
  authReducer,
  INITIAL_AUTH,
  isAppleCancel,
  keepsLocalHistory,
  mergeAppleFullName,
  type AuthState,
} from './authPolicy';
import { createAuthNonce } from './authNonce';
import { mirrorStoredStartupConsent } from './recordStartupConsent';
import { sessionInactiveNow, touchSessionActivity } from './sessionExpiry';
import { AppState } from 'react-native';
import { bindAuthRefresh, getSupabase } from '../../services/supabase';
import { readPublicEnv } from '../../config/env';
import { saveAppleUserId, clearAppleIdentity } from './appleIdentity';
import { fetchAccountSummary } from './accountSummary';
import { performAccountDeletion } from './deleteAccount';
import {
  clearPendingDeletionDue,
  isServerDeletionComplete,
  savePendingDeletionDue,
} from '../../storage/pendingDeletion';
import { t } from '../../i18n';

type AuthContextValue = AuthState & {
  authConfigured: boolean;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
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

  const refreshAccountSummary = useCallback(async () => {
    if (!stateRef.current.userId) return;
    const result = await fetchAccountSummary();
    if (!result.ok) return;
    if (isServerDeletionComplete(result.summary.deletionCompletedAt)) {
      await clearPendingDeletionDue();
    }
    dispatch({
      type: 'account_summary',
      consentVersion: result.summary.consentVersion,
      ageConfirmed: result.summary.ageConfirmed,
      deletionDueAt: result.summary.deletionDueAt,
      deletionCompletedAt: result.summary.deletionCompletedAt,
    });
  }, []);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      dispatch({ type: 'ready_guest' });
      return;
    }
    bindAuthRefresh(supabase);
    let cancelled = false;
    void supabase.auth.getSession().then(async ({ data, error }) => {
      if (cancelled) return;
      if (error || !data.session?.user) {
        dispatch({ type: 'ready_guest' });
        return;
      }
      const userId = data.session.user.id;
      if (await sessionInactiveNow(userId)) {
        await supabase.auth.signOut();
        if (!cancelled) dispatch({ type: 'session_revoked' });
        return;
      }
      await touchSessionActivity(userId);
      if (!cancelled) dispatch({ type: 'ready_session', userId });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || String(event) === 'USER_DELETED') {
        dispatch({ type: 'signed_out' });
        return;
      }
      if (event === 'TOKEN_REFRESHED' && !session) {
        dispatch({ type: 'session_revoked' });
        return;
      }
      if (session?.user) {
        void (async () => {
          if (await sessionInactiveNow(session.user.id)) {
            await supabase.auth.signOut();
            dispatch({ type: 'session_revoked' });
            return;
          }
          await touchSessionActivity(session.user.id);
          if (event === 'SIGNED_IN') void mirrorStoredStartupConsent();
          dispatch({ type: 'ready_session', userId: session.user.id });
        })();
      }
    });
    const appStateSub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      void (async () => {
        const { data } = await supabase.auth.getSession();
        if (!data.session?.user) return;
        if (await sessionInactiveNow(data.session.user.id)) {
          await supabase.auth.signOut();
          dispatch({ type: 'session_revoked' });
          return;
        }
        await touchSessionActivity(data.session.user.id);
      })();
    });

    // Apple credential revocation → guest; keep local translation history.
    const revokeSub = AppleAuthentication.addRevokeListener(() => {
      void (async () => {
        void keepsLocalHistory('credential_revoked');
        const uid = stateRef.current.userId;
        if (uid) await clearAppleIdentity(uid);
        await supabase.auth.signOut();
        dispatch({ type: 'session_revoked' });
      })();
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      appStateSub.remove();
      revokeSub.remove();
    };
  }, []);

  useEffect(() => {
    if (state.status === 'signed-in' && state.userId) {
      void refreshAccountSummary();
    }
  }, [state.status, state.userId, refreshAccountSummary]);

  const signInWithApple = async () => {
    const supabase = getSupabase();
    if (!supabase) {
      dispatch({
        type: 'sign_in_failed',
        message: 'Sign-in is not configured. Translation still works.',
      });
      return;
    }
    dispatch({ type: 'start_sign_in' });
    try {
      const nonce = await createAuthNonce();
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: nonce.hashed,
      });
      if (!credential.identityToken) {
        dispatch({
          type: 'sign_in_failed',
          message: 'Apple did not return an identity token.',
        });
        return;
      }
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
        nonce: nonce.raw,
      });
      if (error || !data.user) {
        dispatch({
          type: 'sign_in_failed',
          message: 'Could not finish sign-in. You can keep translating.',
        });
        return;
      }
      if (credential.user) {
        await saveAppleUserId(data.user.id, credential.user);
      }
      const existingName =
        typeof data.user.user_metadata?.full_name === 'string'
          ? data.user.user_metadata.full_name
          : null;
      const fullName = mergeAppleFullName(
        existingName,
        credential.fullName?.givenName,
        credential.fullName?.familyName,
      );
      const email = credential.email;
      if (
        (fullName && fullName !== existingName) ||
        email
      ) {
        await supabase.auth.updateUser({
          data: {
            ...(fullName ? { full_name: fullName } : {}),
            ...(email ? { email } : {}),
          },
        });
      }
      dispatch({ type: 'ready_session', userId: data.user.id });
    } catch (error) {
      const err = error as { code?: string; message?: string };
      if (isAppleCancel(err)) {
        dispatch({ type: 'apple_cancelled' });
        return;
      }
      dispatch({
        type: 'sign_in_failed',
        message: 'Sign-in failed. You can keep translating.',
      });
    }
  };

  const signOut = async () => {
    const supabase = getSupabase();
    await supabase?.auth.signOut();
    dispatch({ type: 'signed_out' });
  };

  const deleteAccount = async () => {
    const userId = stateRef.current.userId;
    if (!userId) {
      dispatch({
        type: 'deletion_paused',
        message: 'Sign in again, then retry account deletion.',
      });
      return;
    }
    dispatch({ type: 'start_deletion' });
    const result = await performAccountDeletion({ userId });
    if (result.ok) {
      const supabase = getSupabase();
      if (result.scheduled && result.deletionDueAt) {
        await savePendingDeletionDue(result.deletionDueAt);
        const dueLabel = new Date(result.deletionDueAt).toLocaleDateString('en-US', {
          dateStyle: 'medium',
          timeZone: 'America/New_York',
        });
        await supabase?.auth.signOut();
        dispatch({
          type: 'deletion_scheduled',
          deletionDueAt: result.deletionDueAt,
          message: t('auth.deletionScheduledConfirm', 'en', { date: dueLabel }),
        });
        return;
      }
      await supabase?.auth.signOut();
      dispatch({ type: 'deletion_complete' });
      return;
    }
    if (result.code === 'cancelled') {
      dispatch({ type: 'deletion_cancelled' });
      return;
    }
    dispatch({ type: 'deletion_paused', message: result.message });
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      authConfigured,
      signInWithApple,
      signOut,
      deleteAccount,
      refreshAccountSummary,
      clearAlert: () => dispatch({ type: 'dismiss_alert' }),
    }),
    [state, authConfigured, refreshAccountSummary],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx) return ctx;
  return {
    ...INITIAL_AUTH,
    status: 'guest',
    authConfigured: false,
    signInWithApple: async () => undefined,
    signOut: async () => undefined,
    deleteAccount: async () => undefined,
    refreshAccountSummary: async () => undefined,
    clearAlert: () => undefined,
  };
}
