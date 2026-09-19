import {
  authReducer,
  INITIAL_AUTH,
  isAppleCancel,
  keepsLocalHistory,
} from '../authPolicy';
import { canSubmitContribution, requiresSignIn } from '../consent';
import { readPublicEnv } from '../../../config/env';

describe('auth policy', () => {
  test('cancelled Apple sign-in returns to guest without an alert', () => {
    const signing = authReducer(INITIAL_AUTH, { type: 'start_sign_in' });
    const next = authReducer(signing, { type: 'apple_cancelled' });
    expect(next.status).toBe('guest');
    expect(next.alert).toBeNull();
    expect(isAppleCancel({ code: 'ERR_REQUEST_CANCELED' })).toBe(true);
  });

  test('revoked session stays guest and keeps local history', () => {
    const signed = authReducer(INITIAL_AUTH, {
      type: 'ready_session',
      userId: 'user-1',
    });
    const next = authReducer(signed, { type: 'session_revoked' });
    expect(next.status).toBe('guest');
    expect(next.userId).toBeNull();
    expect(keepsLocalHistory('session_revoked')).toBe(true);
    expect(keepsLocalHistory('signed_out')).toBe(true);
  });

  test('translation and learn do not require sign-in', () => {
    expect(requiresSignIn('translate')).toBe(false);
    expect(requiresSignIn('learn')).toBe(false);
    expect(requiresSignIn('history')).toBe(false);
    expect(requiresSignIn('settings')).toBe(false);
    expect(requiresSignIn('contribute')).toBe(true);
  });

  test('contribution gate asks for sign-in before consent', () => {
    expect(
      canSubmitContribution({
        authConfigured: true,
        signedIn: false,
        consentVersion: null,
        ageConfirmed: false,
      }),
    ).toEqual({ ok: false, reason: 'sign_in' });
  });

  test('a service-role key is not treated as app config', () => {
    const env = readPublicEnv({
      EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'service_role-secret',
    });
    expect(env.authConfigured).toBe(false);
  });

  test('a service-role JWT is not treated as app config', () => {
    const b64url = (value: object) =>
      globalThis
        .btoa(JSON.stringify(value))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
    const header = b64url({ alg: 'HS256' });
    const serviceKey = `${header}.${b64url({ role: 'service_role' })}.sig`;
    expect(serviceKey.includes('service_role')).toBe(false);
    expect(
      readPublicEnv({
        EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
        EXPO_PUBLIC_SUPABASE_ANON_KEY: serviceKey,
      }).authConfigured,
    ).toBe(false);
    expect(
      readPublicEnv({
        EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
        EXPO_PUBLIC_SUPABASE_ANON_KEY: `${header}.${b64url({ role: 'anon' })}.sig`,
      }).authConfigured,
    ).toBe(true);
  });
});
