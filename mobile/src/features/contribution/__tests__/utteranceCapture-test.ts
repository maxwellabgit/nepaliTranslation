import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  LOCAL_UTTERANCE_KEEP,
  MAX_UTTERANCE_MS,
  PENDING_UTTERANCE_CAP,
  readPendingUtterances,
  saveUtterance,
  tryUploadPendingUtterances,
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
});
