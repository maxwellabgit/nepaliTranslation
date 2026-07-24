import {
  completeFromItem,
  completeSentenceSplits,
  buildExportPayload,
  loadReviews,
  upsertReview,
  deleteReview,
  clearReviews,
  type GoldReview,
} from '../goldReviews';
import type { GoldItem } from '../../gold/types';

const sampleItem: GoldItem = {
  id: 'en_ne_formal-001',
  class_id: 'en_ne_formal',
  direction: 'en-ne',
  register: 'formal',
  script: 'deva',
  source_lang: 'en',
  target_lang: 'ne',
  source_label: 'English',
  target_label: 'Nepali (formal)',
  source: 'Hello',
  reference: 'नमस्ते',
  pack_status: 'filled',
  provenance: {
    dataset_id: 'hand_authored_seed',
    trust: 'high',
    tier: 'base',
  },
};

describe('completeFromItem', () => {
  it('marks accepted when unchanged', () => {
    const r = completeFromItem(sampleItem, 'Hello', 'नमस्ते');
    expect(r.action).toBe('accepted');
    expect(r.source_final).toBe('Hello');
    expect(r.reference_final).toBe('नमस्ते');
  });

  it('marks edited when changed', () => {
    const r = completeFromItem(sampleItem, 'Hello!', 'नमस्कार');
    expect(r.action).toBe('edited');
  });

  it('merges extras', () => {
    const r = completeFromItem(sampleItem, 'Hello', 'नमस्ते', {
      multi_sentence_flag: true,
    });
    expect(r.multi_sentence_flag).toBe(true);
  });
});

describe('buildExportPayload', () => {
  it('counts only completed reviews', () => {
    const a = completeFromItem(sampleItem, 'Hello', 'नमस्ते');
    const incomplete = { ...a, id: 'x', completed_at: '' } as GoldReview;
    const payload = buildExportPayload({
      [a.id]: a,
      x: incomplete,
    });
    expect(payload.n_completed).toBe(1);
    expect(payload.by_dataset.hand_authored_seed).toBe(1);
    expect(Object.keys(payload.reviews)).toEqual([a.id]);
  });
});

describe('AsyncStorage review map', () => {
  beforeEach(async () => {
    await clearReviews();
  });

  it('round-trips upsert and delete', async () => {
    expect(await loadReviews()).toEqual({});
    const review = completeFromItem(sampleItem, 'Hello', 'नमस्ते');
    const map = await upsertReview(review);
    expect(map[review.id].action).toBe('accepted');
    const loaded = await loadReviews();
    expect(loaded[review.id].reference_final).toBe('नमस्ते');
    const after = await deleteReview(review.id);
    expect(after[review.id]).toBeUndefined();
  });

  it('completeSentenceSplits writes parent and children', async () => {
    const map = await completeSentenceSplits(sampleItem, [
      { source: 'Hi.', reference: 'नमस्ते।' },
      { source: 'Bye.', reference: 'बिदा।' },
    ]);
    expect(map[sampleItem.id].action).toBe('split');
    expect(map[`${sampleItem.id}__s1`].split_index).toBe(1);
    expect(map[`${sampleItem.id}__s2`].provenance.dataset_id).toBe(
      'human_app_review',
    );
  });
});
