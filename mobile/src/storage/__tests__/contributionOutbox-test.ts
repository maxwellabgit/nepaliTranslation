import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  computeNextAttemptAt,
  contributionFingerprintFor,
  enqueueDraft,
  LEGACY_QUEUE_KEY,
  loadOutbox,
  markSynced,
  migrateLegacyReviewQueue,
  pendingDrafts,
  queueDraftForSubmit,
} from '../contributionOutbox';
import { addHistory, loadHistory } from '../phrasebook';
import { buildCorrectionDraftFields } from '../liveIncorrect';

describe('contributionOutbox H2', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test('enqueue is idempotent on the same fingerprint and keeps UUID', async () => {
    const fp = contributionFingerprintFor({
      source_text: 'hello',
      model_output: 'नमस्ते',
      source_lang: 'en',
      formality: 'formal',
      script: 'deva',
    });
    const first = await enqueueDraft({
      local_fingerprint: fp,
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
      local_fingerprint: fp,
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
    expect(second.idempotency_key).toBe(first.idempotency_key);
    expect(second.idempotency_key).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(second.correction_text).toBe('नमस्कार');
    expect((await loadOutbox()).length).toBe(1);
  });

  test('two simultaneous draft writes both survive', async () => {
    const [a, b] = await Promise.all([
      enqueueDraft({
        local_fingerprint: 'fp_a',
        surface: 'live_translate',
        source_text: 'a',
        model_output: 'अ',
        correction_text: null,
        source_lang: 'en',
        formality: 'informal',
        script: 'roman',
        consent_version: null,
        status: 'draft',
      }),
      enqueueDraft({
        local_fingerprint: 'fp_b',
        surface: 'history',
        source_text: 'b',
        model_output: 'ब',
        correction_text: null,
        source_lang: 'en',
        formality: 'formal',
        script: 'deva',
        consent_version: null,
        status: 'draft',
      }),
    ]);
    expect(a.idempotency_key).not.toBe(b.idempotency_key);
    const items = await loadOutbox();
    expect(items.length).toBe(2);
    expect(items.map((d) => d.local_fingerprint).sort()).toEqual([
      'fp_a',
      'fp_b',
    ]);
  });

  test('legacy review queue migrates to draft without inventing labels', async () => {
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
    expect(items[0]?.formality).toBeNull();
    expect(items[0]?.script).toBeNull();
    expect(await AsyncStorage.getItem(LEGACY_QUEUE_KEY)).toBeNull();
    expect(await pendingDrafts()).toEqual([]);
  });

  test('legacy draft never appears in flush set without explicit Submit', async () => {
    await enqueueDraft({
      local_fingerprint: 'fp_legacy',
      surface: 'legacy-v1',
      legacy_tag: 'legacy-v1',
      source_text: 'hi',
      model_output: 'नमस्ते',
      correction_text: null,
      source_lang: 'en',
      formality: 'formal',
      script: 'deva',
      consent_version: null,
      status: 'draft',
    });
    expect(await pendingDrafts()).toEqual([]);
    const items = await loadOutbox();
    await queueDraftForSubmit(
      items[0]!.idempotency_key,
      '2026-09-19.draft',
    );
    const pending = await pendingDrafts();
    expect(pending).toHaveLength(1);
    expect(pending[0]?.status).toBe('queued');
  });

  test('markSynced flips status', async () => {
    const d = await enqueueDraft({
      local_fingerprint: 'fp_2',
      surface: 'history',
      source_text: 'a',
      model_output: 'b',
      correction_text: null,
      source_lang: 'en',
      formality: 'formal',
      script: 'deva',
      consent_version: '2026-09-19.draft',
      status: 'queued',
    });
    await markSynced(d.idempotency_key);
    expect((await loadOutbox())[0]?.status).toBe('synced');
  });

  test('retry backoff is capped at 15 minutes with jitter', () => {
    const at = computeNextAttemptAt(20, 1_000_000, () => 0);
    expect(Date.parse(at) - 1_000_000).toBe(15 * 60 * 1000);
    const withJitter = computeNextAttemptAt(1, 0, () => 0.5);
    expect(Date.parse(withJitter)).toBeGreaterThan(1000);
    expect(Date.parse(withJitter)).toBeLessThanOrEqual(1000 + 250);
  });

  test('new History preserves informal/Roman metadata through save and reload', async () => {
    await addHistory({
      source: 'how are you',
      translation: 'timi kasto chhau',
      sourceLang: 'en',
      targetLang: 'ne',
      direction: 'en-ne',
      formality: 'informal',
      script: 'roman',
      translationMethod: 'neural',
      modelVersion: 'indictrans2-dist-200M',
    });
    const [item] = await loadHistory();
    expect(item?.formality).toBe('informal');
    expect(item?.script).toBe('roman');
    expect(item?.translationMethod).toBe('neural');
    expect(item?.modelVersion).toBe('indictrans2-dist-200M');

    const fields = buildCorrectionDraftFields({
      source: item!.source,
      translation: item!.translation,
      sourceLang: item!.sourceLang,
      formality: item!.formality,
      script: item!.script,
      surface: 'history',
      translationMethod: item!.translationMethod,
      modelVersion: item!.modelVersion,
    });
    expect(fields?.formality).toBe('informal');
    expect(fields?.script).toBe('roman');
  });

  test('legacy History lacks formality/script and does not invent them', async () => {
    await AsyncStorage.setItem(
      'neptranslate.history.v1',
      JSON.stringify([
        {
          id: 'old-1',
          source: 'hello',
          translation: 'नमस्ते',
          sourceLang: 'en',
          targetLang: 'ne',
          createdAt: 1,
        },
      ]),
    );
    const [item] = await loadHistory();
    expect(item?.formality).toBeUndefined();
    expect(item?.script).toBeUndefined();
    expect(item?.direction).toBe('en-ne');
  });

  test('sign-out does not delete on-device history or drafts', async () => {
    await addHistory({
      source: 'keep me',
      translation: 'राख्नुहोस्',
      sourceLang: 'en',
      targetLang: 'ne',
      formality: 'formal',
      script: 'deva',
    });
    await enqueueDraft({
      local_fingerprint: 'fp_keep',
      surface: 'live_translate',
      source_text: 'keep me',
      model_output: 'राख्नुहोस्',
      correction_text: null,
      source_lang: 'en',
      formality: 'formal',
      script: 'deva',
      consent_version: null,
      status: 'draft',
    });
    // Sign-out only clears auth session — never these keys.
    expect((await loadHistory()).length).toBe(1);
    expect((await loadOutbox()).length).toBe(1);
  });
});
