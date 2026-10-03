import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabase } from '../../../services/supabase';
import { loadPendingDeletion } from '../../../storage/pendingDeletion';
import { performDataDeletion } from '../deleteAccount';
import { saveLocalConsent, loadLocalConsent } from '../../../storage/contributionConsent';
import { loadSharingToggles, saveSharingToggles } from '../../../storage/sharingToggles';
import { enqueueDraft, listDrafts } from '../../../storage/contributionOutbox';
jest.mock('../../../config/env', () => ({ readPublicEnv: () => ({ authConfigured: true, supabaseUrl: 'https://example.supabase.co', supabaseAnonKey: 'anon' }) }));
const getSession = jest.fn();
beforeEach(async () => {
  await AsyncStorage.clear();
  (getSupabase as jest.Mock).mockReturnValue({ auth: { getSession } });
  getSession.mockResolvedValue({ data: { session: { user: { id: 'owner' }, access_token: 'jwt' } }, error: null });
});
const response = (body: unknown, ok = true) => ({ ok, json: async () => body } as Response);
test('requests shared-data deletion with subject JWT and no Apple code, preserving other owners', async () => {
  for (const owner of ['owner', 'other']) await enqueueDraft({ owner_user_id: owner, local_fingerprint: owner,
    surface: 'live_translate', source_text: 'hello', model_output: 'नमस्ते', source_lang: 'en', correction_text: null,
    formality: 'formal', script: 'deva', consent_version: 'current', status: 'draft' });
  await saveSharingToggles('owner', { speech: true, photos: false });
  await saveSharingToggles('other', { speech: true, photos: false });
  const fetchImpl = jest.fn(async () => response({ scheduled: true, deletion_due_at: '2026-11-01T00:00:00Z' }));
  expect(await performDataDeletion({ userId: 'owner' }, { fetchImpl })).toEqual({ ok: true, scheduled: true, deletionDueAt: '2026-11-01T00:00:00Z' });
  expect(fetchImpl).toHaveBeenCalledWith('https://example.supabase.co/functions/v1/delete-data', expect.objectContaining({ body: '{}', headers: expect.objectContaining({ authorization: 'Bearer jwt' }) }));
  expect(await loadSharingToggles('owner')).toEqual({ speech: false, photos: false });
  expect(await loadSharingToggles('other')).toEqual({ speech: true, photos: false });
  expect((await listDrafts()).map((row) => row.owner_user_id)).toEqual(['other']);
});
test('never sends a deletion for the wrong JWT subject', async () => {
  const fetchImpl = jest.fn();
  expect(await performDataDeletion({ userId: 'other' }, { fetchImpl })).toEqual(expect.objectContaining({ ok: false, code: 'unauthorized' }));
  expect(fetchImpl).not.toHaveBeenCalled();
});
test('network failure and an unconfirmed deadline stop sharing and retain durable owner intent for retry', async () => {
  await saveLocalConsent(true);
  expect((await performDataDeletion({ userId: 'owner' }, { fetchImpl: jest.fn(async () => { throw new Error('offline'); }) })).ok).toBe(false);
  expect(await loadLocalConsent()).toBeNull();
  expect(await loadPendingDeletion('owner')).toEqual(expect.objectContaining({ ownerId: 'owner', dueAt: null, completedAt: null }));
  expect((await performDataDeletion({ userId: 'owner' }, { fetchImpl: jest.fn(async () => response({ scheduled: true })) })).ok).toBe(false);
  expect(await loadLocalConsent()).toBeNull();
  expect(await loadPendingDeletion('owner')).toEqual(expect.objectContaining({ ownerId: 'owner', dueAt: null, completedAt: null }));
});
