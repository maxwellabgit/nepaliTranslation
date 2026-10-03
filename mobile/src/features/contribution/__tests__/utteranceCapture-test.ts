import AsyncStorage from '@react-native-async-storage/async-storage';
import { enqueueMediaItem, loadMediaOutbox } from '../../../storage/mediaOutbox';
import {
  discardUtterancesForOwner,
  LOCAL_UTTERANCE_KEEP,
  markUtteranceServerAck,
  MAX_UTTERANCE_MS,
  PENDING_BYTE_CAP,
  PENDING_UTTERANCE_CAP,
  readPendingUtterances,
  saveUtterance,
  tryUploadPendingUtterances,
  updateUtteranceFeedback,
} from '../utteranceCapture';

describe('utterance capture', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('keeps several recordings on the device when upload cannot run', async () => {
    const copy = jest.fn(async (uri: string) => ({ uri: `${uri}.kept`, byteSize: 10 }));
    const upload = jest.fn(async () => null);
    for (let n = 0; n < LOCAL_UTTERANCE_KEEP; n += 1) {
      const saved = await saveUtterance(
        {
          transcript: `hello ${n}`,
          audioUri: `file:///tmp/${n}.m4a`,
          feedback: n % 2 === 0 ? 'up' : 'down',
          durationMs: 4_000,
          language: 'en',
        },
        { copy, upload },
      );
      expect(saved.ok).toBe(true);
    }
    const pending = await readPendingUtterances();
    expect(pending).toHaveLength(LOCAL_UTTERANCE_KEEP);
    expect(pending[0]?.transcript).toBe('hello 0');
    expect(pending[0]?.feedback).toBe('up');
  });

  it('refuses an utterance longer than 60 seconds', async () => {
    const saved = await saveUtterance(
      {
        transcript: 'too long',
        audioUri: 'file:///tmp/long.m4a',
        feedback: 'down',
        durationMs: MAX_UTTERANCE_MS + 1,
        language: 'ne',
      },
      { copy: jest.fn(), upload: jest.fn() },
    );
    expect(saved).toEqual({ ok: false, reason: 'too_long' });
    expect(await readPendingUtterances()).toHaveLength(0);
  });

  it('stops at the pending cap and does not hand an ownerless clip to the next account', async () => {
    const copy = jest.fn(async (uri: string) => ({ uri: `${uri}.kept`, byteSize: 10 }));
    const upload = jest.fn(async () => null);
    for (let n = 0; n < PENDING_UTTERANCE_CAP; n += 1) {
      const saved = await saveUtterance(
        {
          transcript: `clip ${n}`,
          audioUri: `file:///tmp/cap-${n}.m4a`,
          feedback: 'unrated',
          durationMs: 1_000,
          language: 'ne',
        },
        { copy, upload },
      );
      expect(saved.ok).toBe(true);
    }
    const full = await saveUtterance(
      {
        transcript: 'one more',
        audioUri: 'file:///tmp/cap-extra.m4a',
        durationMs: 1_000,
        language: 'en',
        userId: 'user-b',
      },
      { copy, upload },
    );
    expect(full).toEqual({ ok: false, reason: 'not_saved' });
    expect(await readPendingUtterances()).toHaveLength(PENDING_UTTERANCE_CAP);
    expect(upload).not.toHaveBeenCalled();
    const handed = await tryUploadPendingUtterances(
      { signedIn: true, authConfigured: true, userId: 'user-b' },
      upload,
    );
    expect(handed).toBe(0);
    expect(upload).not.toHaveBeenCalled();
  });

  it('counts clips that are only queued locally toward the offline cap', async () => {
    const copy = jest.fn(async (uri: string) => ({ uri: `${uri}.kept`, byteSize: 10 }));
    const upload = jest.fn(async () => ({ id: 'queued' }));
    for (let n = 0; n < PENDING_UTTERANCE_CAP; n += 1) {
      const saved = await saveUtterance(
        {
          id: `utt-${n}`,
          transcript: `queued ${n}`,
          audioUri: `file:///tmp/q-${n}.m4a`,
          durationMs: 1_000,
          language: 'en',
          userId: 'user-a',
          eligible: true,
          signedIn: true,
          authConfigured: true,
        },
        { copy, upload },
      );
      expect(saved.ok).toBe(true);
    }
    const extra = await saveUtterance(
      {
        transcript: 'past the cap',
        audioUri: 'file:///tmp/q-extra.m4a',
        durationMs: 1_000,
        language: 'en',
        userId: 'user-a',
        eligible: true,
        signedIn: true,
        authConfigured: true,
      },
      { copy, upload },
    );
    expect(extra).toEqual({ ok: false, reason: 'not_saved' });
    expect(await readPendingUtterances()).toHaveLength(PENDING_UTTERANCE_CAP);
    expect(upload).toHaveBeenCalledTimes(PENDING_UTTERANCE_CAP);
  });

  it('keeps every concurrent save', async () => {
    const copy = jest.fn(async (uri: string) => ({ uri: `${uri}.kept`, byteSize: 8 }));
    const upload = jest.fn(async () => null);
    const saved = await Promise.all(
      [0, 1, 2, 3].map((n) =>
        saveUtterance(
          {
            id: `race-${n}`,
            transcript: `race ${n}`,
            audioUri: `file:///tmp/race-${n}.m4a`,
            durationMs: 1_000,
            language: 'ne',
            userId: 'user-a',
            eligible: true,
          },
          { copy, upload },
        ),
      ),
    );
    expect(saved.every((item) => item.ok)).toBe(true);
    expect(await readPendingUtterances()).toHaveLength(4);
  });

  it('deletes the copy when the byte cap refuses it', async () => {
    const copy = jest.fn(async (uri: string) => ({ uri: `${uri}.kept`, byteSize: PENDING_BYTE_CAP }));
    const deleteFile = jest.fn();
    const first = await saveUtterance(
      {
        id: 'bytes-1',
        transcript: 'first',
        audioUri: 'file:///tmp/bytes-1.m4a',
        durationMs: 1_000,
        language: 'en',
      },
      { copy, deleteFile, upload: jest.fn() },
    );
    expect(first.ok).toBe(true);
    const second = await saveUtterance(
      {
        id: 'bytes-2',
        transcript: 'second',
        audioUri: 'file:///tmp/bytes-2.m4a',
        durationMs: 1_000,
        language: 'en',
      },
      { copy, deleteFile, upload: jest.fn() },
    );
    expect(second).toEqual({ ok: false, reason: 'not_saved' });
    expect(deleteFile).toHaveBeenCalledWith('file:///tmp/bytes-2.m4a.kept');
    expect(await readPendingUtterances()).toHaveLength(1);
  });

  it('keeps unsent clips and only prunes acknowledged files past the local keep', async () => {
    const copy = jest.fn(async (uri: string) => ({ uri: `${uri}.kept`, byteSize: 4 }));
    const deleteFile = jest.fn();
    for (let n = 0; n < LOCAL_UTTERANCE_KEEP + 2; n += 1) {
      await saveUtterance(
        {
          id: `ack-${n}`,
          transcript: `ack ${n}`,
          audioUri: `file:///tmp/ack-${n}.m4a`,
          durationMs: 1_000,
          language: 'en',
          userId: 'user-a',
          capturedAt: new Date(1_000 + n).toISOString(),
        },
        { copy, deleteFile, upload: jest.fn(async () => null) },
      );
    }
    await saveUtterance(
      {
        id: 'still-local',
        transcript: 'unsent',
        audioUri: 'file:///tmp/unsent.m4a',
        durationMs: 1_000,
        language: 'ne',
        userId: 'user-b',
      },
      { copy, deleteFile, upload: jest.fn(async () => null) },
    );
    for (let n = 0; n < LOCAL_UTTERANCE_KEEP + 2; n += 1) {
      await markUtteranceServerAck(`ack-${n}`, 1, deleteFile);
    }
    const pending = await readPendingUtterances();
    expect(pending.map((item) => item.id)).toEqual(['still-local']);
    expect(deleteFile).toHaveBeenCalledWith('file:///tmp/ack-0.m4a.kept');
    expect(deleteFile).toHaveBeenCalledWith('file:///tmp/ack-1.m4a.kept');
    expect(deleteFile).not.toHaveBeenCalledWith('file:///tmp/unsent.m4a.kept');
  });

  it('deletes every file for the withdrawn account and leaves the other account', async () => {
    const copy = jest.fn(async (uri: string) => ({ uri: `${uri}.kept`, byteSize: 4 }));
    const deleteFile = jest.fn();
    await saveUtterance(
      {
        id: 'mine',
        transcript: 'mine',
        audioUri: 'file:///tmp/mine.m4a',
        durationMs: 1_000,
        language: 'en',
        userId: 'user-a',
      },
      { copy, deleteFile, upload: jest.fn(async () => null) },
    );
    await saveUtterance(
      {
        id: 'theirs',
        transcript: 'theirs',
        audioUri: 'file:///tmp/theirs.m4a',
        durationMs: 1_000,
        language: 'ne',
        userId: 'user-b',
      },
      { copy, deleteFile, upload: jest.fn(async () => null) },
    );
    const dropped = await discardUtterancesForOwner('user-a', deleteFile);
    expect(dropped).toEqual(['file:///tmp/mine.m4a.kept']);
    expect(deleteFile).toHaveBeenCalledWith('file:///tmp/mine.m4a.kept');
    expect((await readPendingUtterances()).map((item) => item.id)).toEqual(['theirs']);
  });

  it('stores a later thumb on the existing row without another audio upload', async () => {
    const copy = jest.fn(async (uri: string) => ({ uri: `${uri}.kept`, byteSize: 4 }));
    const upload = jest.fn(async (input: { idempotencyKey?: string; sourceUri: string; byteSize?: number; userId?: string | null; metadata?: Record<string, unknown> }) =>
      enqueueMediaItem({
        idempotency_key: input.idempotencyKey,
        kind: 'speech',
        local_uri: input.sourceUri,
        content_type: 'audio/mp4',
        byte_size: input.byteSize && input.byteSize > 0 ? input.byteSize : 4,
        consent_version: '2026-09-21.media',
        owner_id: input.userId,
        metadata: input.metadata,
      }),
    );
    const saved = await saveUtterance(
      {
        id: 'rate-me',
        transcript: 'hello',
        audioUri: 'file:///tmp/rate.m4a',
        durationMs: 1_000,
        language: 'en',
        userId: 'user-a',
        eligible: true,
        signedIn: true,
        authConfigured: true,
      },
      { copy, upload },
    );
    expect(saved.ok).toBe(true);
    const uploadAgain = jest.fn(async () => {
      throw new Error('second upload');
    });
    const rated = await updateUtteranceFeedback('rate-me', 'down', uploadAgain);
    expect(rated?.feedback).toBe('down');
    expect(rated?.feedbackRevision).toBe(2);
    expect(uploadAgain).not.toHaveBeenCalled();
    const rows = await loadMediaOutbox();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.metadata.feedback).toBe('down');
    expect(rows[0]?.feedback_pending).toBe(true);
    expect(rows[0]?.local_uri).toBe('file:///tmp/rate.m4a.kept');
  });
  it('rejects invalid input or a failed durable copy without retaining or uploading audio', async () => {
    const copy = jest.fn(async () => null);
    const upload = jest.fn();
    const input = { transcript: 'hello', audioUri: 'file:///tmp/failed.m4a', durationMs: 1000, language: 'en' as const };
    expect(await saveUtterance({ ...input, transcript: '   ' }, { copy, upload })).toEqual({ ok: false, reason: 'invalid' });
    expect(await saveUtterance({ ...input, audioUri: '' }, { copy, upload })).toEqual({ ok: false, reason: 'invalid' });
    expect(copy).not.toHaveBeenCalled();
    expect(await saveUtterance(input, { copy, upload })).toEqual({ ok: false, reason: 'invalid' });
    expect(copy).toHaveBeenCalledTimes(1);
    expect(upload).not.toHaveBeenCalled();
    expect(await readPendingUtterances()).toEqual([]);
  });

  it('deletes an unpersisted durable copy after storage fails and allows a later retry', async () => {
    const input = { id: 'retry', transcript: 'hello', audioUri: 'file:///tmp/retry.m4a', durationMs: 1000, language: 'en' as const };
    const copy = jest.fn(async () => ({ uri: 'file:///durable/retry.m4a', byteSize: 10 }));
    const upload = jest.fn();
    const deleteFile = jest.fn();
    const originalWrite = (AsyncStorage.setItem as jest.Mock).getMockImplementation();
    const write = jest.spyOn(AsyncStorage, 'setItem');
    write.mockRejectedValueOnce(new Error('disk full'));
    try {
      expect(await saveUtterance(input, { copy, upload, deleteFile })).toEqual({ ok: false, reason: 'not_saved' });
      expect(deleteFile).toHaveBeenCalledWith('file:///durable/retry.m4a');
      expect(await readPendingUtterances()).toEqual([]);
      expect(upload).not.toHaveBeenCalled();
      expect((await saveUtterance(input, { copy, upload, deleteFile })).ok).toBe(true);
      expect(await readPendingUtterances()).toHaveLength(1);
    } finally { write.mockImplementation(originalWrite!); }
  });

  it('keeps the original recording for duplicate capture IDs without a second copy or upload', async () => {
    const input = { id: 'same-capture', transcript: 'original', audioUri: 'file:///tmp/original.m4a', durationMs: 1000, language: 'en' as const };
    const copy = jest.fn(async () => ({ uri: 'file:///durable/original.m4a', byteSize: 10 }));
    const upload = jest.fn();
    const first = await saveUtterance(input, { copy, upload });
    const repeated = await saveUtterance({ ...input, transcript: 'replacement', userId: 'later-account', eligible: true }, { copy, upload });
    expect(repeated).toEqual(first);
    expect(copy).toHaveBeenCalledTimes(1);
    expect(upload).not.toHaveBeenCalled();
    expect(await readPendingUtterances()).toEqual([expect.objectContaining({ transcript: 'original', ownerId: null, localOnly: true })]);
  });

  it('does not upload feedback for a missing or local-only clip, or discard clips for an empty owner', async () => {
    const upload = jest.fn();
    expect(await updateUtteranceFeedback('missing', 'down', upload)).toBeNull();
    await saveUtterance({ id: 'guest', transcript: 'hello', audioUri: 'file:///tmp/guest.m4a', durationMs: 1000, language: 'en' }, { copy: async () => ({ uri: 'file:///durable/guest.m4a', byteSize: 10 }) });
    expect(await updateUtteranceFeedback('guest', 'up', upload)).toEqual(expect.objectContaining({ feedback: 'up', feedbackRevision: 2, localOnly: true }));
    expect(await updateUtteranceFeedback('guest', 'up', upload)).toEqual(expect.objectContaining({ feedbackRevision: 2 }));
    const deleteFile = jest.fn();
    expect(await discardUtterancesForOwner('', deleteFile)).toEqual([]);
    expect(await readPendingUtterances()).toHaveLength(1);
    expect(deleteFile).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });

});
