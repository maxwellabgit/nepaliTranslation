import * as Crypto from 'expo-crypto';
import {
  authReducer,
  INITIAL_AUTH,
  isAppleCancel,
  keepsLocalHistory,
  mergeAppleFullName,
} from '../authPolicy';
import { createAuthNonce } from '../authNonce';
import { canSubmitContribution, requiresSignIn } from '../consent';
import { readPublicEnv } from '../../../config/env';
import { isForbiddenAuthorizationCodeStorage } from '../appleIdentity';

describe('auth policy', () => {
  test('cancelled Apple sign-in returns to guest without an alert', () => {
    const signing = authReducer(INITIAL_AUTH, { type: 'start_sign_in' });
    const next = authReducer(signing, { type: 'apple_cancelled' });
    expect(next.status).toBe('guest');
    expect(next.alert).toBeNull();
    expect(isAppleCancel({ code: 'ERR_REQUEST_CANCELED' })).toBe(true);
    expect(isAppleCancel({ code: 'ERR_CANCELED' })).toBe(true);
    expect(isAppleCancel({ message: 'User canceled the sign-in flow' })).toBe(
      true,
    );
    expect(isAppleCancel({ code: 'OTHER' })).toBe(false);
  });

  test('apple_cancelled while signed-in returns to signed-in', () => {
    const signed = authReducer(INITIAL_AUTH, {
      type: 'ready_session',
      userId: 'user-1',
    });
    const signing = authReducer(signed, { type: 'start_sign_in' });
    const next = authReducer(signing, { type: 'apple_cancelled' });
    expect(next.status).toBe('signed-in');
    expect(next.userId).toBe('user-1');
  });

  test('dismiss_alert clears error and restores guest or signed-in', () => {
    const failed = authReducer(INITIAL_AUTH, {
      type: 'sign_in_failed',
      message: 'fail',
    });
    expect(authReducer(failed, { type: 'dismiss_alert' }).status).toBe('guest');

    const signedFailed = authReducer(
      { ...INITIAL_AUTH, status: 'error', userId: 'u1', error: 'x', alert: 'x' },
      { type: 'dismiss_alert' },
    );
    expect(signedFailed.status).toBe('signed-in');
    expect(signedFailed.alert).toBeNull();
  });

  test('account_summary updates consent fields', () => {
    const signed = authReducer(INITIAL_AUTH, {
      type: 'ready_session',
      userId: 'user-1',
    });
    const next = authReducer(signed, {
      type: 'account_summary',
      consentVersion: '2026-09-19.draft',
      ageConfirmed: true,
    });
    expect(next.consentVersion).toBe('2026-09-19.draft');
    expect(next.ageConfirmed).toBe(true);
  });

  test('deletion_complete and signed_out reset to guest', () => {
    const signed = authReducer(INITIAL_AUTH, {
      type: 'ready_session',
      userId: 'user-1',
    });
    expect(authReducer(signed, { type: 'deletion_complete' }).status).toBe(
      'guest',
    );
    expect(authReducer(signed, { type: 'signed_out' }).userId).toBeNull();
  });

  test('deletion_cancelled returns to signed-in', () => {
    const deleting = authReducer(
      authReducer(INITIAL_AUTH, { type: 'ready_session', userId: 'u1' }),
      { type: 'start_deletion' },
    );
    const next = authReducer(deleting, { type: 'deletion_cancelled' });
    expect(next.status).toBe('signed-in');
    expect(next.deletionRetryPending).toBe(false);
  });

  test('unknown action returns previous state', () => {
    const signed = authReducer(INITIAL_AUTH, {
      type: 'ready_session',
      userId: 'user-1',
    });
    expect(
      authReducer(signed, { type: 'unknown' } as unknown as { type: 'ready_guest' }),
    ).toBe(signed);
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
    expect(keepsLocalHistory('credential_revoked')).toBe(true);
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

  test('first sign-in captures name; later null name keeps existing', () => {
    expect(mergeAppleFullName(null, 'Ada', 'Lovelace')).toBe('Ada Lovelace');
    expect(mergeAppleFullName('Ada Lovelace', null, null)).toBe('Ada Lovelace');
    expect(mergeAppleFullName('Ada Lovelace', undefined, undefined)).toBe(
      'Ada Lovelace',
    );
  });

  test('deletion paused keeps signed-in session for retry', () => {
    const signed = authReducer(INITIAL_AUTH, {
      type: 'ready_session',
      userId: 'user-1',
    });
    const deleting = authReducer(signed, { type: 'start_deletion' });
    expect(deleting.status).toBe('deleting');
    const paused = authReducer(deleting, {
      type: 'deletion_paused',
      message: 'Apple token revocation failed.',
    });
    expect(paused.status).toBe('signed-in');
    expect(paused.userId).toBe('user-1');
    expect(paused.deletionRetryPending).toBe(true);
    expect(paused.alert).toMatch(/revocation failed/i);
  });

  test('never stores short-lived authorization codes under legacy keys', () => {
    expect(
      isForbiddenAuthorizationCodeStorage(
        'neptranslate.apple-authorization-code.user-1',
      ),
    ).toBe(true);
    expect(
      isForbiddenAuthorizationCodeStorage('neptranslate.apple-user.user-1'),
    ).toBe(false);
  });
});

describe('auth nonce (Apple hashed / Supabase raw)', () => {
  test('hashed nonce is SHA-256 of the raw nonce for Apple and Supabase', async () => {
    const pair = await createAuthNonce(32);
    expect(pair.raw).toMatch(/^[0-9a-f]+$/);
    expect(pair.raw.length).toBe(64);
    expect(Crypto.getRandomBytesAsync).toHaveBeenCalled();
    expect(Crypto.digestStringAsync).toHaveBeenCalledWith(
      Crypto.CryptoDigestAlgorithm.SHA256,
      pair.raw,
    );
    expect(pair.hashed).toBe(`sha256:${pair.raw}`);
    // Contract: Apple gets hashed; Supabase gets raw (same pair).
    const appleNonce = pair.hashed;
    const supabaseNonce = pair.raw;
    expect(appleNonce).not.toBe(supabaseNonce);
    expect(appleNonce).toBe(await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      supabaseNonce,
    ));
  });

  test('createAuthNonce does not use Math.random', async () => {
    const spy = jest.spyOn(Math, 'random');
    await createAuthNonce();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
