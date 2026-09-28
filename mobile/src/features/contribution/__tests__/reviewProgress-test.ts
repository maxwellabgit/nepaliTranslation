import AsyncStorage from '@react-native-async-storage/async-storage';
import { readReviewProgress, writeReviewProgress } from '../reviewProgress';

describe('review progress', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('keeps finished questions until the 5:00 PM New York close', async () => {
    const now = new Date('2026-09-28T15:00:00.000Z');
    await writeReviewProgress({
      windowId: 'w-1',
      closeAt: '2026-09-28T21:00:00.000Z',
      reviewedIds: ['src-1'],
      now,
    });
    const saved = await readReviewProgress(now);
    expect(saved?.reviewedIds).toEqual(['src-1']);
    expect(saved?.expiresAt).toBe('2026-09-28T21:00:00.000Z');
  });

  it('drops progress after that close', async () => {
    await writeReviewProgress({
      windowId: 'w-1',
      closeAt: '2026-09-28T21:00:00.000Z',
      reviewedIds: ['src-1'],
      now: new Date('2026-09-28T15:00:00.000Z'),
    });
    const saved = await readReviewProgress(new Date('2026-09-28T21:00:01.000Z'));
    expect(saved).toBeNull();
  });
});
