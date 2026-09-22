import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearMediaOutbox,
  enqueueMediaItem,
  loadMediaOutbox,
  MEDIA_OUTBOX_KEY,
  pendingMediaItems,
  markMediaRetry,
  computeMediaNextAttemptAt,
} from '../mediaOutbox';

describe('mediaOutbox', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test('enqueue auto-queues and is idempotent by key', async () => {
    const a = await enqueueMediaItem({
      idempotency_key: 'media-1',
      kind: 'photo',
      local_uri: 'file:///tmp/a.jpg',
      content_type: 'image/jpeg',
      byte_size: 1200,
      consent_version: '2026-09-21.media',
    });
    expect(a.status).toBe('queued');
    const b = await enqueueMediaItem({
      idempotency_key: 'media-1',
      kind: 'photo',
      local_uri: 'file:///tmp/a.jpg',
      content_type: 'image/jpeg',
      byte_size: 1200,
      consent_version: '2026-09-21.media',
    });
    expect(b.id).toBe(a.id);
    const items = await loadMediaOutbox();
    expect(items).toHaveLength(1);
  });

  test('pending includes retry past nextAttemptAt', async () => {
    const item = await enqueueMediaItem({
      kind: 'speech',
      local_uri: 'file:///tmp/a.m4a',
      content_type: 'audio/mp4',
      byte_size: 800,
      consent_version: '2026-09-21.media',
    });
    await markMediaRetry(
      item.idempotency_key,
      'network_error',
      new Date(Date.now() - 1000).toISOString(),
    );
    const pending = await pendingMediaItems();
    expect(pending.some((p) => p.idempotency_key === item.idempotency_key)).toBe(
      true,
    );
  });

  test('backoff caps at 15 minutes', () => {
    const at = computeMediaNextAttemptAt(20, 0, () => 0);
    expect(Date.parse(at)).toBeLessThanOrEqual(15 * 60 * 1000);
  });

  test('clearMediaOutbox removes storage key', async () => {
    await enqueueMediaItem({
      kind: 'photo',
      local_uri: 'file:///tmp/b.jpg',
      content_type: 'image/jpeg',
      byte_size: 10,
      consent_version: '2026-09-21.media',
    });
    await clearMediaOutbox();
    expect(await AsyncStorage.getItem(MEDIA_OUTBOX_KEY)).toBeNull();
  });
});
