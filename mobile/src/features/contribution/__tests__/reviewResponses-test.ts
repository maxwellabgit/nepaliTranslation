import AsyncStorage from '@react-native-async-storage/async-storage';
import { captureReviewResponse, readReviewResponses, clearReviewResponseUploads, flushReviewResponses } from '../reviewResponses';
import { loadOutbox } from '../../../storage/contributionOutbox';
import { saveLocalConsent } from '../../../storage/contributionConsent';
import type { ReviewItem } from '../publicReviewApi';
import { SESSION_INACTIVITY_MS, touchSessionActivity } from '../../auth/sessionExpiry';
import { CONTRIBUTION_CONSENT_VERSION } from '../../auth/consent';
import { getSupabase } from '../../../services/supabase';
jest.mock('../../../config/env', () => ({ readPublicEnv: () => ({ authConfigured: true }) }));
jest.mock('../../../app/featureFlags', () => ({ getRuntimeFeatureFlags: () => ({ contributionTextEnabled: true }) }));
jest.mock('../../../services/supabase', () => ({ getSupabase: jest.fn() }));
jest.mock('../../../services/contributionSync', () => ({ flushPendingDrafts: jest.fn(async () => ({ ok: true })) }));
const currentConsent = { consentVersion: CONTRIBUTION_CONSENT_VERSION, ageConfirmed: true };
const item: ReviewItem = { slot: 1, source_item_id: 'a:english', direction: 'en-ne', register: 'formal', script: 'deva', source_text: 'Hello', proposed_target: 'नमस्ते', length_tier: 1, scheduled_credits: 1 };
describe('review response revisions', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    (getSupabase as jest.Mock).mockReturnValue({ auth: { getSession: async () => ({ data: { session: { user: { id: 'owner' }, access_token: 'token' } } }) } });
  });
  it('keeps original confirm answers and changed answers as independent durable submissions', async () => {
    await saveLocalConsent(true, 'owner');
    const first = await captureReviewResponse({ windowId: 'w', item, action: 'confirm', answer: 'original blind answer', userId: 'owner', ...currentConsent });
    const second = await captureReviewResponse({ windowId: 'w', item, action: 'edit', answer: 'changed answer', correctedText: 'changed answer', userId: 'owner', ...currentConsent });
    expect(first.id).not.toBe(second.id);
    expect((await readReviewResponses()).map((r) => [r.answer, r.revision])).toEqual([['original blind answer', 1], ['changed answer', 2]]);
    const queued = await loadOutbox();
    expect(queued).toHaveLength(2);
    expect(queued.map((r) => r.owner_user_id)).toEqual(['owner', 'owner']);
    expect(queued.find((r) => r.id === first.id)?.review_metadata?.answer).toBe('original blind answer');
    await clearReviewResponseUploads('owner');
    expect(await readReviewResponses()).toEqual([]);
    expect(await loadOutbox()).toEqual([]);
  });
  it('guest, missing consent and skip records stay local and cannot join a later account', async () => {
    await captureReviewResponse({ windowId: 'w', item, action: 'edit', answer: 'guest', userId: null });
    await captureReviewResponse({ windowId: 'w', item, action: 'edit', answer: 'declined', userId: 'owner' });
    await captureReviewResponse({ windowId: 'w', item, action: 'edit', answer: 'declined revision', userId: 'owner' });
    await saveLocalConsent(true, 'owner');
    await captureReviewResponse({ windowId: 'w', item, action: 'skip', answer: '', userId: 'owner' });
    expect((await readReviewResponses()).every((r) => r.status === 'local' && r.userId === null)).toBe(true);
    expect(await loadOutbox()).toEqual([]);
    expect((await readReviewResponses()).map((row) => row.revision)).toEqual([1, 2, 3, 4]);
  });
  it('does not queue responses from an inactive account', async () => {
    await saveLocalConsent(true, 'owner');
    await touchSessionActivity('owner', Date.now() - SESSION_INACTIVITY_MS - 1);
    const row = await captureReviewResponse({ windowId: 'w', item, action: 'confirm', answer: 'answer', userId: 'owner', ...currentConsent });
    expect(row.userId).toBeNull();
    expect(await loadOutbox()).toEqual([]);
  });
  it('never adopts device-global A consent into B responses before B consents', async () => {
    await saveLocalConsent(true, 'owner'); // Previous owner A left a device-level record.
    (getSupabase as jest.Mock).mockReturnValue({ auth: { getSession: async () => ({ data: { session: { user: { id: 'B' }, access_token: 'token-B' } } }) } });
    const earlier = await captureReviewResponse({ windowId: 'w', item, action: 'confirm', answer: 'B before consent', userId: 'B', consentVersion: null, ageConfirmed: false });
    expect(earlier.userId).toBeNull();
    expect(earlier.status).toBe('local');
    await saveLocalConsent(true, 'B');
    const later = await captureReviewResponse({ windowId: 'w', item, action: 'confirm', answer: 'B after consent', userId: 'B', ...currentConsent });
    await flushReviewResponses('B');
    expect((await loadOutbox()).map((row) => row.idempotency_key)).toEqual([later.id]);
    expect((await readReviewResponses()).find((row) => row.id === earlier.id)?.userId).toBeNull();
  });
  it('ignores stale UI owner consent if the live session belongs to another account', async () => {
    await saveLocalConsent(true, 'owner');
    const row = await captureReviewResponse({ windowId: 'w', item, action: 'confirm', answer: 'stale view', userId: 'B', ...currentConsent });
    expect(row.userId).toBeNull();
    expect(await loadOutbox()).toEqual([]);
  });
  it('withdrawal serialized with recovery cannot resurrect an owned pending revision', async () => {
    await saveLocalConsent(true, 'owner');
    await captureReviewResponse({ windowId: 'w', item, action: 'confirm', answer: 'owned answer', userId: 'owner', ...currentConsent });
    await Promise.all([flushReviewResponses('owner'), clearReviewResponseUploads('owner')]);
    expect(await readReviewResponses()).toEqual([]);
    expect(await loadOutbox()).toEqual([]);
    await flushReviewResponses('owner');
    expect(await loadOutbox()).toEqual([]);
  });
});
