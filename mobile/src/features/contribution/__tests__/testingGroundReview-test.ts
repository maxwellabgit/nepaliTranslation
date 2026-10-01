import { fetchCurrentReviewWindow, submitReview } from '../publicReviewApi';
import { groupReviewItems } from '../reviewFlow';
import { TESTING_GROUND_DAILY_REVIEW } from '../testingGroundReview';

describe('testing ground daily review', () => {
  const previous = (globalThis as { window?: unknown }).window;

  afterEach(() => {
    if (previous === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = previous;
    }
  });

  it('holds ten samples in each category and serves them only inside the testing ground', async () => {
    expect(TESTING_GROUND_DAILY_REVIEW).toHaveLength(30);
    expect(new Set(TESTING_GROUND_DAILY_REVIEW.map((row) => row.slot)).size).toBe(30);
    const grouped = groupReviewItems(TESTING_GROUND_DAILY_REVIEW);
    expect(grouped.deva).toHaveLength(10);
    expect(grouped.roman).toHaveLength(10);
    expect(grouped.english).toHaveLength(10);

    (globalThis as { window?: unknown }).window = {
      __NEPTRANSLATE_TG__: { harness: 'neptranslate-testing-ground' },
    };
    const result = await fetchCurrentReviewWindow();
    expect(result.ok).toBe(true);
    if (result.ok) {
      const shipped = groupReviewItems(result.items);
      expect(shipped.deva).toHaveLength(10);
      expect(shipped.roman).toHaveLength(10);
      expect(shipped.english).toHaveLength(10);
      expect(result.window?.window_id.startsWith('review-day-')).toBe(true);
    }

    const saved = await submitReview({
      windowId: 'tg-daily-10',
      sourceItemId: 'tg-deva-01',
      action: 'confirm',
    });
    expect(saved.ok).toBe(true);
  });
});
