import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import {
  authReducer,
  INITIAL_AUTH,
  isAppleCancel,
  randomNonce,
  type AuthState,
} from './authPolicy';
import { bindAuthRefresh, getSupabase } from '../../services/supabase';
import { readPublicEnv } from '../../config/env';
import { saveAppleAuthorizationCode } from './appleAuthCode';

type AuthContextValue = AuthState & {
  authConfigured: boolean;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
  clearAlert: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function hashedNonce(raw: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, raw);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, INITIAL_AUTH);
  const authConfigured = readPublicEnv().authConfigured;

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      dispatch({ type: 'ready_guest' });
      return;
    }
    bindAuthRefresh(supabase);
    let cancelled = false;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data.session?.user) {
        dispatch({ type: 'ready_guest' });
        return;
      }
      dispatch({ type: 'ready_session', userId: data.session.user.id });
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
        dispatch({ type: 'ready_session', userId: session.user.id });
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

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
    const rawNonce = randomNonce();
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: await hashedNonce(rawNonce),
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
        nonce: rawNonce,
      });
      if (error || !data.user) {
        dispatch({
          type: 'sign_in_failed',
          message: 'Could not finish sign-in. You can keep translating.',
        });
        return;
      }
      const given = credential.fullName?.givenName;
      const family = credential.fullName?.familyName;
      const fullName = [given, family].filter(Boolean).join(' ');
      if (fullName || credential.email) {
        await supabase.auth.updateUser({
          data: {
            ...(fullName ? { full_name: fullName } : {}),
            ...(credential.email ? { email: credential.email } : {}),
          },
        });
      }
      if (credential.authorizationCode) {
        await saveAppleAuthorizationCode(data.user.id, credential.authorizationCode);
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

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      authConfigured,
      signInWithApple,
      signOut,
      clearAlert: () => dispatch({ type: 'dismiss_alert' }),
    }),
    [state, authConfigured],
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
    clearAlert: () => undefined,
  };
}
