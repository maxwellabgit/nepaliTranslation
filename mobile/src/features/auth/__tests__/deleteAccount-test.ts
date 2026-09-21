import * as AppleAuthentication from 'expo-apple-authentication';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { performAccountDeletion } from '../deleteAccount';
import { saveAppleUserId, loadAppleUserId, clearAppleIdentity } from '../appleIdentity';
import { getSupabase } from '../../../services/supabase';
import {
  clearCachedEntitlement,
  loadCachedEntitlement,
  saveCachedEntitlement,
} from '../../entitlements/entitlementCache';
import {
  saveLocalConsent,
  loadLocalConsent,
  clearLocalConsent,
} from '../../../storage/contributionConsent';
import {
  clearContributionCaches,
  loadOutbox,
  enqueueDraft,
} from '../../../storage/contributionOutbox';
import { loadHistory, addHistory, clearHistory } from '../../../storage/phrasebook';
import { keepsLocalHistory } from '../authPolicy';

jest.mock('../../../config/env', () => ({
  readPublicEnv: () => ({
    supabaseUrl: 'https://example.supabase.co',
    supabaseAnonKey: 'anon-key',
    authConfigured: true,
  }),
}));

const mockSignInWithIdToken = jest.fn();
const mockGetSession = jest.fn();
const mockSignOut = jest.fn();

function seedSecureStore() {
  const mem = new Map<string, string>();
  (SecureStore.getItemAsync as jest.Mock).mockImplementation(
    async (k: string) => mem.get(k) ?? null,
  );
  (SecureStore.setItemAsync as jest.Mock).mockImplementation(
    async (k: string, v: string) => {
      mem.set(k, v);
    },
  );
  (SecureStore.deleteItemAsync as jest.Mock).mockImplementation(
    async (k: string) => {
      mem.delete(k);
    },
  );
}

async function seedContributionDraft() {
  await enqueueDraft({
    local_fingerprint: 'fp-test-1',
    surface: 'live_translate',
    source_text: 'hi',
    model_output: 'नमस्ते',
    correction_text: null,
    source_lang: 'en',
    formality: 'formal',
    script: 'deva',
    consent_version: null,
    status: 'draft',
  });
}

async function seedHistory() {
  await addHistory({
    source: 'hi',
    translation: 'नमस्ते',
    sourceLang: 'en',
    targetLang: 'ne',
  });
}

beforeEach(async () => {
  await AsyncStorage.clear();
  await clearHistory();
  seedSecureStore();

  mockGetSession.mockResolvedValue({
    data: { session: { access_token: 'tok', user: { id: 'user-1' } } },
  });
  mockSignInWithIdToken.mockResolvedValue({
    data: { user: { id: 'user-1' } },
    error: null,
  });
  (getSupabase as jest.Mock).mockReturnValue({
    auth: {
      getSession: mockGetSession,
      signInWithIdToken: mockSignInWithIdToken,
      signOut: mockSignOut,
    },
  });
  (AppleAuthentication.refreshAsync as jest.Mock).mockReset();
  (AppleAuthentication.signInAsync as jest.Mock).mockReset();
});

describe('Apple identity storage', () => {
  test('stores only the stable Apple user id in SecureStore', async () => {
    await saveAppleUserId('user-1', 'apple.stable.user');
    expect(await loadAppleUserId('user-1')).toBe('apple.stable.user');
    const legacy = await AsyncStorage.getItem(
      'neptranslate.apple-authorization-code.user-1',
    );
    expect(legacy).toBeNull();
  });
});

describe('performAccountDeletion', () => {
  test('uses a fresh refresh authorization code — never an old stored code', async () => {
    await saveAppleUserId('user-1', 'apple.stable.user');
    await AsyncStorage.setItem(
      'neptranslate.apple-authorization-code.user-1',
      'OLD_STALE_CODE_SHOULD_NOT_BE_SENT',
    );

    (AppleAuthentication.refreshAsync as jest.Mock).mockResolvedValue({
      user: 'apple.stable.user',
      authorizationCode: 'FRESH_CODE_FROM_REFRESH',
      identityToken: 'id-token',
    });

    const bodies: string[] = [];
    const fetchImpl = jest.fn(async (_url: string, init?: RequestInit) => {
      bodies.push(String(init?.body ?? ''));
      return new Response(JSON.stringify({ deleted: true }), { status: 200 });
    });

    const result = await performAccountDeletion(
      { userId: 'user-1' },
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    expect(result.ok).toBe(true);
    expect(AppleAuthentication.refreshAsync).toHaveBeenCalledWith(
      expect.objectContaining({ user: 'apple.stable.user' }),
    );
    expect(bodies[0]).toContain('FRESH_CODE_FROM_REFRESH');
    expect(bodies[0]).not.toContain('OLD_STALE_CODE');
  });

  test('cancelled refresh changes nothing', async () => {
    await saveAppleUserId('user-1', 'apple.stable.user');
    (AppleAuthentication.refreshAsync as jest.Mock).mockRejectedValue({
      code: 'ERR_REQUEST_CANCELED',
    });
    const fetchImpl = jest.fn();
    const result = await performAccountDeletion(
      { userId: 'user-1' },
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    expect(result).toEqual(
      expect.objectContaining({ ok: false, code: 'cancelled' }),
    );
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(await loadAppleUserId('user-1')).toBe('apple.stable.user');
  });

  test('missing authorization code pauses before purge', async () => {
    await saveAppleUserId('user-1', 'apple.stable.user');
    (AppleAuthentication.refreshAsync as jest.Mock).mockResolvedValue({
      user: 'apple.stable.user',
      authorizationCode: null,
      identityToken: 'id-token',
    });
    const fetchImpl = jest.fn();
    const result = await performAccountDeletion(
      { userId: 'user-1' },
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    expect(result).toEqual(
      expect.objectContaining({ ok: false, code: 'missing_authorization_code' }),
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('revoke failure proves purge was not completed on the client', async () => {
    await saveAppleUserId('user-1', 'apple.stable.user');
    await saveCachedEntitlement({
      earnedAdFreeUntilMs: null,
      lifetimeCredits: 5,
      version: 1,
      syncedAtMs: 1,
    });
    await saveLocalConsent(true);
    await seedContributionDraft();
    await seedHistory();

    (AppleAuthentication.refreshAsync as jest.Mock).mockResolvedValue({
      user: 'apple.stable.user',
      authorizationCode: 'FRESH_CODE',
      identityToken: 'id-token',
    });
    const fetchImpl = jest.fn(
      async () =>
        new Response(
          JSON.stringify({
            error: { code: 'apple_revoke_failed' },
            completed: [],
          }),
          { status: 409 },
        ),
    );

    const result = await performAccountDeletion(
      { userId: 'user-1' },
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('apple_revoke_failed');
    expect(await loadAppleUserId('user-1')).toBe('apple.stable.user');
    expect(await loadCachedEntitlement()).not.toBeNull();
    expect(await loadLocalConsent()).not.toBeNull();
    expect((await loadOutbox()).length).toBeGreaterThan(0);
    expect((await loadHistory()).length).toBe(1);
  });

  test('successful deletion clears secure identity and contribution/reward caches but not history', async () => {
    await saveAppleUserId('user-1', 'apple.stable.user');
    await saveCachedEntitlement({
      earnedAdFreeUntilMs: null,
      lifetimeCredits: 5,
      version: 1,
      syncedAtMs: 1,
    });
    await saveLocalConsent(true);
    await seedContributionDraft();
    await seedHistory();

    (AppleAuthentication.refreshAsync as jest.Mock).mockResolvedValue({
      user: 'apple.stable.user',
      authorizationCode: 'FRESH_CODE',
      identityToken: 'id-token',
    });
    const fetchImpl = jest.fn(
      async () =>
        new Response(JSON.stringify({ deleted: true }), { status: 200 }),
    );

    const result = await performAccountDeletion(
      { userId: 'user-1' },
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    expect(result.ok).toBe(true);
    expect(await loadAppleUserId('user-1')).toBeNull();
    expect(await loadCachedEntitlement()).toBeNull();
    expect(await loadLocalConsent()).toBeNull();
    expect(await loadOutbox()).toEqual([]);
    expect((await loadHistory()).length).toBe(1);
  });

  test('missing local Apple user requires interactive reauth of the same account', async () => {
    (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue({
      user: 'apple.reauth.user',
      authorizationCode: 'REAUTH_FRESH_CODE',
      identityToken: 'id-token',
      fullName: null,
      email: null,
    });
    mockSignInWithIdToken.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    const fetchImpl = jest.fn(async (_url: string, init?: RequestInit) => {
      expect(String(init?.body)).toContain('REAUTH_FRESH_CODE');
      return new Response(JSON.stringify({ deleted: true }), { status: 200 });
    });

    const result = await performAccountDeletion(
      { userId: 'user-1' },
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    expect(result.ok).toBe(true);
    expect(AppleAuthentication.refreshAsync).not.toHaveBeenCalled();
    expect(AppleAuthentication.signInAsync).toHaveBeenCalled();
  });

  test('wrong Apple account on reauth does not purge', async () => {
    (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue({
      user: 'other.apple',
      authorizationCode: 'CODE',
      identityToken: 'id-token',
    });
    mockSignInWithIdToken.mockResolvedValue({
      data: { user: { id: 'other-user' } },
      error: null,
    });
    const fetchImpl = jest.fn();
    const result = await performAccountDeletion(
      { userId: 'user-1' },
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    expect(result).toEqual(
      expect.objectContaining({ ok: false, code: 'wrong_apple_account' }),
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('retry after revoke failure resumes by sending a fresh code again', async () => {
    await saveAppleUserId('user-1', 'apple.stable.user');
    (AppleAuthentication.refreshAsync as jest.Mock)
      .mockResolvedValueOnce({
        user: 'apple.stable.user',
        authorizationCode: 'CODE_1',
        identityToken: 'id',
      })
      .mockResolvedValueOnce({
        user: 'apple.stable.user',
        authorizationCode: 'CODE_2',
        identityToken: 'id',
      });

    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: { code: 'apple_revoke_failed' },
            completed: [],
          }),
          { status: 409 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ deleted: true }), { status: 200 }),
      );

    const first = await performAccountDeletion(
      { userId: 'user-1' },
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    expect(first.ok).toBe(false);
    if (!first.ok) expect(first.code).toBe('apple_revoke_failed');

    const second = await performAccountDeletion(
      { userId: 'user-1' },
      { fetchImpl: fetchImpl as unknown as typeof fetch },
    );
    expect(second.ok).toBe(true);
    expect(String(fetchImpl.mock.calls[0][1]?.body)).toContain('CODE_1');
    expect(String(fetchImpl.mock.calls[1][1]?.body)).toContain('CODE_2');
  });
});

describe('Apple credential revocation listener contract', () => {
  test('keeps local history flag is true for credential revoke', () => {
    expect(keepsLocalHistory('credential_revoked')).toBe(true);
  });

  test('clearAppleIdentity does not touch translation history', async () => {
    await seedHistory();
    await saveAppleUserId('user-1', 'apple.u');
    await clearAppleIdentity('user-1');
    expect(await loadAppleUserId('user-1')).toBeNull();
    expect((await loadHistory()).length).toBe(1);
    await clearLocalConsent();
    await clearContributionCaches();
    await clearCachedEntitlement();
  });
});
