import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  enqueueDraft,
  LEGACY_QUEUE_KEY,
  loadOutbox,
  markSynced,
  migrateLegacyReviewQueue,
} from '../contributionOutbox';

describe('contributionOutbox', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test('enqueue is idempotent on the same key', async () => {
    const first = await enqueueDraft({
      idempotency_key: 'corr_1',
      surface: 'live_translate',
      source_text: 'hello',
      model_output: 'नमस्ते',
      correction_text: null,
      source_lang: 'en',
      formality: 'formal',
      script: 'deva',
      consent_version: null,
      status: 'draft',
    });
    const second = await enqueueDraft({
      idempotency_key: 'corr_1',
      surface: 'live_translate',
      source_text: 'hello',
      model_output: 'नमस्ते',
      correction_text: 'नमस्कार',
      source_lang: 'en',
      formality: 'formal',
      script: 'deva',
      consent_version: null,
      status: 'draft',
    });
    expect(second.id).toBe(first.id);
    expect(second.correction_text).toBe('नमस्कार');
    expect((await loadOutbox()).length).toBe(1);
  });

  test('legacy review queue migrates to draft without uploading', async () => {
    await AsyncStorage.setItem(
      LEGACY_QUEUE_KEY,
      JSON.stringify([
        {
          meaning_id: 'm1',
          english: 'thanks',
          ne_formal_final: 'धन्यवाद',
        },
      ]),
    );
    const n = await migrateLegacyReviewQueue();
    expect(n).toBe(1);
    const items = await loadOutbox();
    expect(items[0]?.surface).toBe('legacy-v1');
    expect(items[0]?.status).toBe('draft');
    expect(await AsyncStorage.getItem(LEGACY_QUEUE_KEY)).toBeNull();
  });

  test('markSynced flips status', async () => {
    await enqueueDraft({
      idempotency_key: 'corr_2',
      surface: 'history',
      source_text: 'a',
      model_output: 'b',
      correction_text: null,
      source_lang: 'en',
      formality: 'formal',
      script: 'deva',
      consent_version: '2026-09-19.draft',
      status: 'pending',
    });
    await markSynced('corr_2');
    expect((await loadOutbox())[0]?.status).toBe('synced');
  });
});
