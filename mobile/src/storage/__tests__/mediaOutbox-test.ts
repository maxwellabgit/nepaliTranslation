import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearMediaOutbox,
  enqueueMediaItem,
  loadMediaOutbox,
  MEDIA_OUTBOX_KEY,
  mergeMediaFeedback,
  pendingMediaItems,
  markMediaRetry,
  markMediaSynced,
  computeMediaNextAttemptAt,
  SPEECH_OUTBOX_CAP,
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
    if (!a) throw new Error('enqueue failed');
    expect(a.status).toBe('queued');
    const b = await enqueueMediaItem({
      idempotency_key: 'media-1',
      kind: 'photo',
      local_uri: 'file:///tmp/a.jpg',
      content_type: 'image/jpeg',
      byte_size: 1200,
      consent_version: '2026-09-21.media',
    });
    if (!b) throw new Error('enqueue failed');
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
    if (!item) throw new Error('enqueue failed');
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

  test('a full speech queue keeps every unsent clip', async () => {
    for (let n = 0; n < SPEECH_OUTBOX_CAP; n += 1) {
      const item = await enqueueMediaItem({
        idempotency_key: `speech-${n}`,
        kind: 'speech',
        local_uri: `file:///tmp/${n}.m4a`,
        content_type: 'audio/mp4',
        byte_size: 10,
        consent_version: '2026-09-21.media',
      });
      expect(item?.idempotency_key).toBe(`speech-${n}`);
    }
    const extra = await enqueueMediaItem({
      idempotency_key: 'speech-extra',
      kind: 'speech',
      local_uri: 'file:///tmp/extra.m4a',
      content_type: 'audio/mp4',
      byte_size: 10,
      consent_version: '2026-09-21.media',
    });
    expect(extra).toBeNull();
    const items = await loadMediaOutbox();
    expect(items).toHaveLength(SPEECH_OUTBOX_CAP);
    expect(items.some((item) => item.idempotency_key === 'speech-0')).toBe(true);
    expect(items.some((item) => item.idempotency_key === 'speech-extra')).toBe(false);
  });

  test('a later rating stays on the synced row without a second audio object', async () => {
    const item = await enqueueMediaItem({
      idempotency_key: 'utt:user-a:1',
      kind: 'speech',
      local_uri: 'file:///tmp/rated.m4a',
      content_type: 'audio/mp4',
      byte_size: 80,
      consent_version: '2026-09-21.media',
      metadata: { feedback: 'unrated', feedbackRevision: 1, utteranceId: 'utt-1' },
    });
    await markMediaSynced(item!.idempotency_key);
    const merged = await mergeMediaFeedback('utt:user-a:1', {
      feedback: 'down',
      feedbackRevision: 2,
      utteranceId: 'utt-1',
    });
    expect(merged?.status).toBe('synced');
    expect(merged?.feedback_pending).toBe(true);
    expect(merged?.metadata.feedback).toBe('down');
    expect(await loadMediaOutbox()).toHaveLength(1);
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
