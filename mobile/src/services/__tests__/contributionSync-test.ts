import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabase } from '../supabase';
import { readPublicEnv } from '../../config/env';
import {
  enqueueDraft,
  loadOutbox,
  OUTBOX_KEY,
  pendingDrafts,
} from '../../storage/contributionOutbox';
import {
  __resetFlushMutexForTests,
  flushPendingDrafts,
  postTranslationReport,
} from '../contributionSync';

jest.mock('../supabase', () => ({
  getSupabase: jest.fn(),
  bindAuthRefresh: jest.fn(),
}));

jest.mock('../../config/env', () => ({
  readPublicEnv: jest.fn(),
}));

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
    mockedReadPublicEnv.mockReturnValue(env);
    mockedGetSupabase.mockReturnValue({
      auth: {
        getSession: async () => ({
          data: { session: { access_token: 'tok' } },
        }),
      },
    } as never);
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
      consent_version: '2026-09-19.draft',
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
      consent_version: '2026-09-19.draft',
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
      consent_version: '2026-09-19.draft',
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
      consent_version: '2026-09-19.draft',
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
      consent_version: '2026-09-19.draft',
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
