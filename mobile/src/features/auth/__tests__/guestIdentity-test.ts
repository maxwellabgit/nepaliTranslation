import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SupabaseClient } from '@supabase/supabase-js';
import { saveLocalConsent, loadLocalConsent } from '../../../storage/contributionConsent';
import { enqueueDraft, listDrafts } from '../../../storage/contributionOutbox';
import { ensurePrivateIdentity } from '../guestIdentity';
const session = (id = 'guest-1') => ({ user: { id }, access_token: 'jwt', expires_at: Date.now() / 1000 + 3600 });
function client(existing: unknown = null) {
  const auth = { getSession: jest.fn(async () => ({ data: { session: existing }, error: null })),
    refreshSession: jest.fn(async () => ({ data: { session: null }, error: new Error('offline') })),
    signInAnonymously: jest.fn(async () => ({ data: { session: session() }, error: null })) };
  return { auth };
}
const asClient = (value: ReturnType<typeof client>) => value as unknown as SupabaseClient;
beforeEach(async () => { await AsyncStorage.clear(); });
test('creates one persisted anonymous subject across concurrent requests', async () => {
  const value = client();
  expect(await Promise.all([ensurePrivateIdentity(asClient(value)), ensurePrivateIdentity(asClient(value))])).toEqual(['guest-1', 'guest-1']);
  expect(value.auth.signInAnonymously).toHaveBeenCalledTimes(1);
  value.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
  expect(await ensurePrivateIdentity(asClient(value))).toBeNull();
  expect(value.auth.signInAnonymously).toHaveBeenCalledTimes(1);
  expect(value.auth.refreshSession).toHaveBeenCalledTimes(1);
});
test('preserves existing historical identity without anonymous creation', async () => {
  const value = client(session('legacy-user'));
  expect(await ensurePrivateIdentity(asClient(value))).toBe('legacy-user');
  expect(value.auth.signInAnonymously).not.toHaveBeenCalled();
  expect(await AsyncStorage.getItem('neptranslate.private_identity.v1')).toBe('legacy-user');
});
test('network/session failure never replaces a known identity or adopts another subject', async () => {
  await AsyncStorage.setItem('neptranslate.private_identity.v1', 'owner-A');
  const value = client(session('owner-B'));
  expect(await ensurePrivateIdentity(asClient(value))).toBeNull();
  expect(value.auth.signInAnonymously).not.toHaveBeenCalled();
  expect(await AsyncStorage.getItem('neptranslate.private_identity.v1')).toBe('owner-A');
});
test('a first-install network failure can retry without creating a local identity', async () => {
  const value = client();
  value.auth.signInAnonymously.mockRejectedValueOnce(new Error('offline'));
  expect(await ensurePrivateIdentity(asClient(value))).toBeNull();
  expect(await AsyncStorage.getItem('neptranslate.private_identity.v1')).toBeNull();
  expect(await ensurePrivateIdentity(asClient(value))).toBe('guest-1');
});

test('expired sessions require a refreshed JWT for the same subject', async () => {
  const value = client({ ...session('owner'), expires_at: Date.now() / 1000 - 1 });
  value.auth.refreshSession.mockResolvedValueOnce({ data: { session: session('owner') } as never, error: null as never });
  expect(await ensurePrivateIdentity(asClient(value))).toBe('owner');
  expect(value.auth.refreshSession).toHaveBeenCalledTimes(1);
  expect(value.auth.signInAnonymously).not.toHaveBeenCalled();
});
test('a session read error never invokes anonymous creation', async () => {
  const value = client();
  value.auth.getSession.mockRejectedValueOnce(new Error('storage unavailable'));
  expect(await ensurePrivateIdentity(asClient(value))).toBeNull();
  expect(value.auth.signInAnonymously).not.toHaveBeenCalled();
});

test('terminal lost credentials recover a new private identity without adopting old owner data or consent', async () => {
  await AsyncStorage.setItem('neptranslate.private_identity.v1', 'lost-owner');
  await saveLocalConsent(true);
  await enqueueDraft({ owner_user_id: 'lost-owner', local_fingerprint: 'old', surface: 'live_translate',
    source_text: 'hello', model_output: 'नमस्ते', correction_text: null, source_lang: 'en',
    formality: 'formal', script: 'deva', consent_version: 'old', status: 'queued' });
  const value = client();
  value.auth.refreshSession.mockResolvedValueOnce({ data: { session: null }, error: { name: 'AuthSessionMissingError' } as never });
  expect(await ensurePrivateIdentity(asClient(value))).toBe('guest-1');
  expect(await loadLocalConsent()).toBeNull();
  expect((await listDrafts()).map((row) => row.owner_user_id)).toEqual(['lost-owner']);
  expect(await AsyncStorage.getItem('neptranslate.private_identity.v1')).toBe('guest-1');
});

test('terminal credential loss returned by getSession also recovers without keeping old consent', async () => {
  await AsyncStorage.setItem('neptranslate.private_identity.v1', 'lost-owner');
  await saveLocalConsent(true);
  const value = client();
  value.auth.getSession.mockResolvedValueOnce({ data: { session: null }, error: { code: 'refresh_token_not_found' } as never });
  expect(await ensurePrivateIdentity(asClient(value))).toBe('guest-1');
  expect(await loadLocalConsent()).toBeNull();
  expect(value.auth.signInAnonymously).toHaveBeenCalledTimes(1);
});
