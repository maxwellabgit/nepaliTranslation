import type { ReviewItem } from '../publicReviewApi';
import {
  comparisonChoices,
  creditAwardDeadline,
  formatCountdown,
  groupReviewItems,
  judgmentToSubmit,
  nextNewYorkFivePm,
  reviewCategoryOf,
} from '../reviewFlow';

function item(partial: Partial<ReviewItem> & Pick<ReviewItem, 'source_item_id' | 'direction' | 'script'>): ReviewItem {
  return {
    slot: 1,
    source_text: 'source',
    proposed_target: 'target',
    register: 'formal',
    length_tier: 1,
    scheduled_credits: 2,
    ...partial,
  };
}

describe('review flow categories', () => {
  it('groups working-from Devanagari, Romanized, and English', () => {
    const items = [
      item({ source_item_id: 'e', direction: 'en-ne', script: 'deva' }),
      item({ source_item_id: 'd', direction: 'ne-en', script: 'deva' }),
      item({ source_item_id: 'r', direction: 'ne-en', script: 'roman' }),
      item({ source_item_id: 'n', direction: 'ne-en', script: 'noisy_roman' }),
    ];
    expect(reviewCategoryOf(items[0])).toBe('english');
    const grouped = groupReviewItems(items);
    expect(grouped.english.map((row) => row.source_item_id)).toEqual(['e']);
    expect(grouped.deva.map((row) => row.source_item_id)).toEqual(['d']);
    expect(grouped.roman.map((row) => row.source_item_id)).toEqual(['r', 'n']);
  });

  it('confirms same meaning and reports when neither line is right', () => {
    expect(judgmentToSubmit('same', 'नमस्ते', 'नमस्ते संसार')).toEqual({
      action: 'confirm',
    });
    expect(judgmentToSubmit('same', 'नमस्ते', null)).toEqual({
      action: 'edit',
      correctedText: 'नमस्ते',
    });
    expect(judgmentToSubmit('ours', 'मेरो', 'सुझाव')).toEqual({
      action: 'confirm',
    });
    expect(judgmentToSubmit('mine', 'मेरो', 'सुझाव')).toEqual({
      action: 'edit',
      correctedText: 'मेरो',
    });
    expect(judgmentToSubmit('neither', 'केही', 'सुझाव')).toEqual({
      action: 'report',
    });
  });

  it('never confirms a source-only item', () => {
    expect(comparisonChoices(null)).toEqual(['mine', 'same', 'neither']);
    expect(comparisonChoices('  ')).toEqual(['mine', 'same', 'neither']);
    expect(comparisonChoices('सुझाव')).toEqual(['ours', 'mine', 'same', 'neither']);
    expect(judgmentToSubmit('mine', 'When will you arrive?', null)).toEqual({
      action: 'edit',
      correctedText: 'When will you arrive?',
    });
    expect(judgmentToSubmit('same', 'When will you arrive?', null)).toEqual({
      action: 'edit',
      correctedText: 'When will you arrive?',
    });
    expect(judgmentToSubmit('ours', 'When will you arrive?', null).action).toBe('edit');
    expect(judgmentToSubmit('neither', 'When will you arrive?', null)).toEqual({
      action: 'report',
    });
  });
});

describe('credit award countdown', () => {
  it('uses the open window close when it is still ahead', () => {
    const now = new Date('2026-09-28T15:00:00.000Z');
    const deadline = creditAwardDeadline(now, '2026-09-28T21:00:00.000Z');
    expect(deadline.toISOString()).toBe('2026-09-28T21:00:00.000Z');
  });

  it('rolls to the next 5:00 PM New York after the window has closed', () => {
    const now = new Date('2026-09-28T22:00:00.000Z');
    expect(nextNewYorkFivePm(now).toISOString()).toBe('2026-09-29T21:00:00.000Z');
    expect(creditAwardDeadline(now, '2026-09-28T21:00:00.000Z').toISOString()).toBe(
      '2026-09-29T21:00:00.000Z',
    );
  });

  it('uses the Eastern standard offset in winter', () => {
    const now = new Date('2026-01-15T21:30:00.000Z');
    expect(nextNewYorkFivePm(now).toISOString()).toBe('2026-01-15T22:00:00.000Z');
  });

  it('formats the remaining time as a clock', () => {
    expect(formatCountdown(0)).toBe('00:00:00');
    expect(formatCountdown(3 * 3600_000 + 4 * 60_000 + 5_000)).toBe('03:04:05');
  });
});
