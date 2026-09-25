import {
  __resetMediaFlushMutexForTests,
  flushPendingMedia,
  uploadMediaItem,
} from '../mediaSync';
import {
  enqueueMediaItem,
  loadMediaOutbox,
  markMediaSynced,
} from '../../storage/mediaOutbox';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabase } from '../supabase';
import { readPublicEnv } from '../../config/env';

jest.mock('../supabase');
jest.mock('../../config/env');

const mockedGetSupabase = getSupabase as jest.MockedFunction<typeof getSupabase>;
const mockedReadPublicEnv = readPublicEnv as jest.MockedFunction<
  typeof readPublicEnv
>;

describe('mediaSync', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    __resetMediaFlushMutexForTests();
    mockedReadPublicEnv.mockReturnValue({
      authConfigured: true,
      supabaseUrl: 'https://example.supabase.co',
      supabaseAnonKey: 'anon',
    } as never);
  });

  test('flag_disabled rejects without retry storm', async () => {
    const item = await enqueueMediaItem({
      idempotency_key: 'm-flag',
      kind: 'photo',
      local_uri: 'file:///tmp/x.jpg',
      content_type: 'image/jpeg',
      byte_size: 100,
      consent_version: '2026-09-21.media',
    });
    const fetchImpl = jest.fn(async () =>
      Promise.resolve({
        ok: false,
        status: 403,
        json: async () => ({ error: { code: 'flag_disabled' } }),
      }),
    ) as unknown as typeof fetch;

    const outcome = await uploadMediaItem(
      item,
      'tok',
      {
        supabaseUrl: 'https://example.supabase.co',
        supabaseAnonKey: 'anon',
      },
      fetchImpl,
    );
    expect(outcome).toEqual({ kind: 'rejected', code: 'flag_disabled' });
  });

  test('withdrawn authorization skips completion after the bytes are uploaded', async () => {
    const item = await enqueueMediaItem({
      idempotency_key: 'm-inflight',
      kind: 'photo',
      local_uri: 'file:///tmp/inflight.jpg',
      content_type: 'image/jpeg',
      byte_size: 100,
      consent_version: '2026-09-21.media',
      owner_id: 'user-a',
    });
    const fetchImpl = jest.fn(async (url: string) => {
      if (String(url).startsWith('file:')) {
        return {
          ok: true,
          status: 200,
          arrayBuffer: async () => new ArrayBuffer(8),
        };
      }
      if (String(url).includes('create-media-upload')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            media_id: '11111111-1111-4111-8111-111111111111',
            upload_url: 'https://example.supabase.co/storage/v1/object/sign/x',
            token: 'signed',
            status: 'pending_upload',
          }),
        };
      }
      if (String(url).includes('/object/')) {
        return { ok: true, status: 200, json: async () => ({}) };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ status: 'uploaded' }),
      };
    }) as unknown as typeof fetch;
    const outcome = await uploadMediaItem(
      item,
      'tok',
      { supabaseUrl: 'https://example.supabase.co', supabaseAnonKey: 'anon' },
      fetchImpl,
      async () => false,
    );
    expect(outcome).toEqual({ kind: 'rejected', code: 'sharing_disabled' });
    const urls = (fetchImpl as unknown as jest.Mock).mock.calls.map((call) =>
      String(call[0]),
    );
    expect(urls.some((url) => url.includes('complete-media-upload'))).toBe(false);
  });

  test('flushPendingMedia no-ops when unauthorized', async () => {
    mockedGetSupabase.mockReturnValue({
      auth: {
        getSession: async () => ({ data: { session: null } }),
      },
    } as never);
    await enqueueMediaItem({
      kind: 'photo',
      local_uri: 'file:///tmp/y.jpg',
      content_type: 'image/jpeg',
      byte_size: 50,
      consent_version: '2026-09-21.media',
    });
    const result = await flushPendingMedia();
    expect(result).toEqual({ ok: false, reason: 'unauthorized' });
    const items = await loadMediaOutbox();
    expect(items[0].status).toBe('queued');
  });

  test('synced items are not flushed again', async () => {
    const item = await enqueueMediaItem({
      idempotency_key: 'm-synced',
      kind: 'speech',
      local_uri: 'file:///tmp/z.m4a',
      content_type: 'audio/mp4',
      byte_size: 200,
      consent_version: '2026-09-21.media',
    });
    await markMediaSynced(item.idempotency_key);
    mockedGetSupabase.mockReturnValue({
      auth: {
        getSession: async () => ({
          data: {
            session: { access_token: 'tok', user: { id: 'user-a' } },
          },
        }),
      },
    } as never);
    const fetchImpl = jest.fn() as unknown as typeof fetch;
    const result = await flushPendingMedia(fetchImpl);
    expect(result).toEqual({ ok: true, synced: 0, failed: 0, rejected: 0 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('account B does not upload account A files', async () => {
    await enqueueMediaItem({
      idempotency_key: 'm-owner-a',
      kind: 'photo',
      local_uri: 'file:///tmp/a.jpg',
      content_type: 'image/jpeg',
      byte_size: 80,
      consent_version: '2026-09-21.media',
      owner_id: 'user-a',
      consent_epoch: '2026-09-21.media',
    });
    mockedGetSupabase.mockReturnValue({
      auth: {
        getSession: async () => ({
          data: {
            session: { access_token: 'tok', user: { id: 'user-b' } },
          },
        }),
      },
    } as never);
    const fetchImpl = jest.fn() as unknown as typeof fetch;
    const result = await flushPendingMedia(fetchImpl);
    expect(result).toEqual({ ok: true, synced: 0, failed: 0, rejected: 0 });
    expect(fetchImpl).not.toHaveBeenCalled();
    const items = await loadMediaOutbox();
    expect(items[0].status).toBe('queued');
    expect(items[0].owner_id).toBe('user-a');
  });
});
