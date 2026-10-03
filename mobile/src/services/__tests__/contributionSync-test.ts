import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabase } from '../supabase';
import { readPublicEnv } from '../../config/env';
import { DEFAULT_FEATURE_FLAGS, setRuntimeFeatureFlags } from '../../app/featureFlags';
import { saveLocalConsent } from '../../storage/contributionConsent';
import {
  enqueueDraft as rawEnqueueDraft,
  loadOutbox,
  OUTBOX_KEY,
  pendingDrafts,
} from '../../storage/contributionOutbox';
import {
  __resetFlushMutexForTests,
  flushPendingDrafts,
  postTranslationReport,
} from '../contributionSync';

import { CONTRIBUTION_CONSENT_VERSION } from '../../features/auth/consent';
import { savePendingDeletionIntent } from '../../storage/pendingDeletion';
jest.mock('../supabase', () => ({
  getSupabase: jest.fn(),
  bindAuthRefresh: jest.fn(),
}));

jest.mock('../../config/env', () => ({
  readPublicEnv: jest.fn(),
}));

const enqueueDraft = (input: Parameters<typeof rawEnqueueDraft>[0]) => rawEnqueueDraft({ owner_user_id: 'owner', ...input });

const env = {
  supabaseUrl: 'https://example.supabase.co',
  supabaseAnonKey: 'anon-key',
  authConfigured: true,
};

const mockedGetSupabase = getSupabase as jest.MockedFunction<typeof getSupabase>;
const mockedReadPublicEnv = readPublicEnv as jest.MockedFunction<
  typeof readPublicEnv
>;

describe('contributionSync H2', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    __resetFlushMutexForTests();
    setRuntimeFeatureFlags({ ...DEFAULT_FEATURE_FLAGS, contributionTextEnabled: true });
    await saveLocalConsent(true, 'owner');
    mockedReadPublicEnv.mockReturnValue(env);
    mockedGetSupabase.mockReturnValue({
      auth: {
        getSession: async () => ({
          data: { session: { access_token: 'tok', user: { id: 'owner' } } },
        }),
      },
    } as never);
  });

  test('private guest JWT uploads only its consented original rows, never another owner or ownerless data', async () => {
    for (const owner of [null, 'old-account', 'owner']) await rawEnqueueDraft({
      local_fingerprint: `private-owner-${owner}`, owner_user_id: owner,
      surface: 'live_translate', source_text: 'Hello', model_output: 'नमस्ते', correction_text: 'नमस्कार',
      source_lang: 'en', formality: 'formal', script: 'deva', translation_method: 'neural',
      consent_version: CONTRIBUTION_CONSENT_VERSION, status: 'queued',
    });
    const send = jest.fn<Promise<Response>, Parameters<typeof fetch>>(async () => ({
      status: 200, json: async () => ({}),
    } as Response));
    expect(await flushPendingDrafts(send as unknown as typeof fetch)).toEqual({ ok: true, synced: 1, failed: 0, rejected: 0 });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]![1]!.headers).toEqual(expect.objectContaining({ authorization: 'Bearer tok' }));
    expect((await loadOutbox()).filter(row => row.status === 'queued')).toHaveLength(2);
  });

  test('durable deletion blocks queued text despite a late consent callback', async () => {
    const raw = await AsyncStorage.getItem('neptranslate.contribution_consent.v1');
    await enqueueDraft({ local_fingerprint: 'deleting-owner', surface: 'history',
      source_text: 'Hello', model_output: 'Hello', correction_text: 'Hi',
      source_lang: 'en', formality: 'formal', script: 'deva',
      consent_version: CONTRIBUTION_CONSENT_VERSION, status: 'queued' });
    await savePendingDeletionIntent('owner');
    if (raw) await AsyncStorage.setItem('neptranslate.contribution_consent.v1', raw);
    const send = jest.fn();
    await flushPendingDrafts(send);
    expect(send).not.toHaveBeenCalled();
    expect((await loadOutbox())[0]?.status).toBe('queued');
  });

  test('never posts a queued correction without a valid authenticated session', async () => {
    await enqueueDraft({
      local_fingerprint: 'fp_unauthorized', surface: 'history',
      source_text: 'Hello', model_output: 'नमस्ते', correction_text: 'नमस्कार',
      source_lang: 'en', formality: 'formal', script: 'deva',
      consent_version: CONTRIBUTION_CONSENT_VERSION, status: 'queued',
    });
    const send = jest.fn();
    mockedGetSupabase.mockReturnValue({ auth: { getSession: async () => ({
      data: { session: null },
    }) } } as never);
    expect(await flushPendingDrafts(send as unknown as typeof fetch)).toEqual({ ok: false, reason: 'unauthorized' });
    mockedGetSupabase.mockReturnValue(null);
    expect(await flushPendingDrafts(send as unknown as typeof fetch)).toEqual({ ok: false, reason: 'unavailable' });
    expect(send).not.toHaveBeenCalled();
    expect((await loadOutbox())[0]?.status).toBe('queued');
  });

  test('review revisions upload only for their authorized owner, rechecking consent for each row', async () => {
    setRuntimeFeatureFlags({ ...DEFAULT_FEATURE_FLAGS, contributionTextEnabled: true });
    const consent = await saveLocalConsent(true, 'owner');
    if (!consent) throw new Error('Owner consent fixture rejected');
    let owner = 'other';
    mockedGetSupabase.mockReturnValue({ auth: { getSession: async () => ({ data: { session: { access_token: 'tok', user: { id: owner } } } }) } } as never);
    for (const revision of [1, 2]) await enqueueDraft({
      idempotency_key: `review-owner-${revision}`, local_fingerprint: `review-owner-${revision}`, owner_user_id: 'owner',
      surface: 'live_translate', source_text: 'Hello', model_output: 'नमस्ते', correction_text: `answer ${revision}`,
      source_lang: 'en', formality: 'formal', script: 'deva', translation_method: 'todays_10',
      consent_version: consent.consent_version, status: 'queued', review_metadata: { revision, answer: `answer ${revision}` },
    });
    const send = jest.fn(async () => {
      setRuntimeFeatureFlags(DEFAULT_FEATURE_FLAGS);
      return { status: 200, json: async () => ({}) } as Response;
    });
    await flushPendingDrafts(send as unknown as typeof fetch);
    expect(send).not.toHaveBeenCalled();
    owner = 'owner';
    await flushPendingDrafts(send as unknown as typeof fetch);
    expect(send).toHaveBeenCalledTimes(1);
    expect((await loadOutbox()).filter((row) => row.status === 'synced')).toHaveLength(1);
    expect((await loadOutbox()).filter((row) => row.status === 'queued')).toHaveLength(1);
    setRuntimeFeatureFlags(DEFAULT_FEATURE_FLAGS);
  });

  test('ineligible newer rows cannot starve eligible older review revisions', async () => {
    setRuntimeFeatureFlags({ ...DEFAULT_FEATURE_FLAGS, contributionTextEnabled: true });
    const consent = await saveLocalConsent(true, 'owner');
    if (!consent) throw new Error('Owner consent fixture rejected');
    mockedGetSupabase.mockReturnValue({ auth: { getSession: async () => ({ data: { session: { access_token: 'tok', user: { id: 'owner' } } } }) } } as never);
    for (let index = 0; index < 25; index += 1) await enqueueDraft({
      idempotency_key: `review-starve-${index}`, local_fingerprint: `review-starve-${index}`,
      owner_user_id: index === 0 ? 'owner' : 'other', surface: 'live_translate', source_text: 'Hello', model_output: 'नमस्ते', correction_text: `answer ${index}`,
      source_lang: 'en', formality: 'formal', script: 'deva', translation_method: 'todays_10',
      consent_version: consent.consent_version, status: 'queued',
    });
    const send = jest.fn<Promise<Response>, Parameters<typeof fetch>>(async () => ({ status: 200, json: async () => ({}) } as Response));
    await flushPendingDrafts(send as unknown as typeof fetch);
    expect(send).toHaveBeenCalledTimes(1);
    expect(JSON.parse(send.mock.calls[0]![1]!.body as string).idempotency_key).toBe('review-starve-0');
    setRuntimeFeatureFlags(DEFAULT_FEATURE_FLAGS);
  });

  test('rejects unlabeled or unconsented corrections before the network boundary', async () => {
    const draft = await enqueueDraft({
      local_fingerprint: 'fp_unlabeled', surface: 'history',
      source_text: 'Hello', model_output: 'नमस्ते', correction_text: 'नमस्कार',
      source_lang: 'en', formality: 'formal', script: 'deva',
      consent_version: CONTRIBUTION_CONSENT_VERSION, status: 'queued',
    });
    const send = jest.fn();
    expect(await postTranslationReport({ ...draft, script: null }, 'tok', env, send))
      .toEqual({ kind: 'rejected', code: 'labels_required' });
    expect(await postTranslationReport({ ...draft, consent_version: null }, 'tok', env, send))
      .toEqual({ kind: 'rejected', code: 'consent_required' });
    expect(send).not.toHaveBeenCalled();
  });

  test('400 consent mismatch is rejected; 500 and timeout are retryable', async () => {
    const base = {
      idempotency_key: 'k1',
      local_fingerprint: 'fp1',
      surface: 'live_translate' as const,
      source_text: 'hi',
      model_output: 'नमस्ते',
      correction_text: null,
      source_lang: 'en' as const,
      formality: 'formal' as const,
      script: 'deva' as const,
      consent_version: CONTRIBUTION_CONSENT_VERSION,
      status: 'queued' as const,
      id: 'd1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const consent = await postTranslationReport(base, 'tok', env, async () =>
      ({
        ok: false,
        status: 400,
        json: async () => ({ code: 'consent_outdated' }),
      }) as Response,
    );
    expect(consent).toEqual({ kind: 'rejected', code: 'consent_outdated' });

    const server = await postTranslationReport(base, 'tok', env, async () =>
      ({
        ok: false,
        status: 500,
        json: async () => ({}),
      }) as Response,
    );
    expect(server).toEqual({ kind: 'retry', code: 'http_500' });

    const timeout = await postTranslationReport(
      base,
      'tok',
      env,
      async () => {
        const err = new Error('aborted');
        err.name = 'AbortError';
        throw err;
      },
    );
    expect(timeout).toEqual({ kind: 'retry', code: 'timeout' });
  });

  test('offline submit then reconnect yields exactly one server record', async () => {
    const draft = await enqueueDraft({
      local_fingerprint: 'fp_once',
      surface: 'live_translate',
      source_text: 'hello',
      model_output: 'नमस्ते',
      correction_text: null,
      source_lang: 'en',
      formality: 'informal',
      script: 'roman',
      consent_version: CONTRIBUTION_CONSENT_VERSION,
      status: 'queued',
    });

    let posts = 0;
    const fetchImpl: typeof fetch = async () => {
      posts += 1;
      if (posts === 1) {
        throw new TypeError('Network request failed');
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ receipt_id: 'r1' }),
      } as Response;
    };

    const first = await flushPendingDrafts(fetchImpl);
    expect(first).toEqual({ ok: true, synced: 0, failed: 1, rejected: 0 });
    expect((await loadOutbox())[0]?.status).toBe('retry');

    const items = await loadOutbox();
    await AsyncStorage.setItem(
      OUTBOX_KEY,
      JSON.stringify([
        { ...items[0], nextAttemptAt: new Date(0).toISOString() },
      ]),
    );

    const second = await flushPendingDrafts(fetchImpl);
    expect(second).toEqual({ ok: true, synced: 1, failed: 0, rejected: 0 });
    expect((await loadOutbox())[0]?.status).toBe('synced');
    expect((await loadOutbox())[0]?.idempotency_key).toBe(
      draft.idempotency_key,
    );
    expect(posts).toBe(2);
  });

  test('app kill between send and ack replays once via 409', async () => {
    await enqueueDraft({
      local_fingerprint: 'fp_kill',
      surface: 'history',
      source_text: 'x',
      model_output: 'y',
      correction_text: null,
      source_lang: 'en',
      formality: 'formal',
      script: 'deva',
      consent_version: CONTRIBUTION_CONSENT_VERSION,
      status: 'syncing',
    });

    let posts = 0;
    const keys: string[] = [];
    const fetchImpl: typeof fetch = async (_url, init) => {
      posts += 1;
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        idempotency_key: string;
      };
      keys.push(body.idempotency_key);
      return {
        ok: false,
        status: 409,
        json: async () => ({ code: 'already_exists' }),
      } as Response;
    };

    const result = await flushPendingDrafts(fetchImpl);
    expect(result).toEqual({ ok: true, synced: 1, failed: 0, rejected: 0 });
    expect(posts).toBe(1);
    expect(keys[0]).toBeTruthy();
    expect((await loadOutbox())[0]?.status).toBe('synced');
  });

  test('drafts are never flushed', async () => {
    await enqueueDraft({
      local_fingerprint: 'fp_draft_only',
      surface: 'legacy-v1',
      legacy_tag: 'legacy-v1',
      source_text: 'nope',
      model_output: 'नहुने',
      correction_text: null,
      source_lang: 'en',
      formality: 'formal',
      script: 'deva',
      consent_version: CONTRIBUTION_CONSENT_VERSION,
      status: 'draft',
    });
    expect(await pendingDrafts()).toEqual([]);
    let fetched = false;
    const result = await flushPendingDrafts(async () => {
      fetched = true;
      return { ok: true, status: 200, json: async () => ({}) } as Response;
    });
    expect(fetched).toBe(false);
    expect(result).toEqual({ ok: true, synced: 0, failed: 0, rejected: 0 });
  });

  test('informal/Roman labels travel in the request payload', async () => {
    await enqueueDraft({
      local_fingerprint: 'fp_labels',
      surface: 'history',
      source_text: 'how are you',
      model_output: 'timi kasto chhau',
      correction_text: 'timi ksto chhau',
      source_lang: 'en',
      formality: 'informal',
      script: 'roman',
      translation_method: 'neural',
      model_version: 'indictrans2-dist-200M',
      consent_version: CONTRIBUTION_CONSENT_VERSION,
      status: 'queued',
    });

    let body: Record<string, unknown> = {};
    await flushPendingDrafts(async (_url, init) => {
      body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
      return {
        ok: true,
        status: 200,
        json: async () => ({}),
      } as Response;
    });
    expect(body.formality).toBe('informal');
    expect(body.script).toBe('roman');
    expect(body.direction).toBe('en-ne');
    expect(
      (body.metadata as { translation_method?: string })?.translation_method,
    ).toBe('neural');
  });
});
