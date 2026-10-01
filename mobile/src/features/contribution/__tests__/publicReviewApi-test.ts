import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  creditLabelForCredits,
  fetchCurrentReviewWindow,
  firstUnsubmittedIndex,
  submitReview,
} from '../publicReviewApi';
import { allottedSampleCount } from '../sampleAllotment';

describe('bundled review samples', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    globalThis.fetch = jest.fn() as typeof fetch;
  });

  test('loads the shipped set without a server review update', async () => {
    expect(allottedSampleCount()).toBeGreaterThanOrEqual(150);
    const result = await fetchCurrentReviewWindow();
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.mine).toEqual([]);
  });

  test('keeps the caller submissions and skips to the next item', () => {
    expect(
      firstUnsubmittedIndex(
        [{ source_item_id: 'src-1' }, { source_item_id: 'src-2' }],
        [{ source_item_id: 'src-1' }],
      ),
    ).toBe(1);
  });

  test('submitReview stays on the device', async () => {
    const empty = await submitReview({
      windowId: 'w-1',
      sourceItemId: 'src-1',
      action: 'edit',
      correctedText: '   ',
    });
    expect(empty).toEqual({ ok: false, reason: 'invalid' });
    const saved = await submitReview({
      windowId: 'w-1',
      sourceItemId: 'src-1',
      action: 'confirm',
    });
    expect(saved.ok).toBe(true);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  test('credit copy respects the length tier (1 credit = 10 min)', () => {
    expect(creditLabelForCredits(2)).toBe('2 credits · 20 min ad-free');
    expect(creditLabelForCredits(4)).toBe('4 credits · 40 min ad-free');
  });
});
