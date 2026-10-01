import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  allottedSampleCount,
  passedAllotmentRatio,
  recordCompletedSample,
} from '../sampleAllotment';

describe('shipped review samples', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('includes at least 150 samples in the download', () => {
    expect(allottedSampleCount()).toBeGreaterThanOrEqual(150);
  });

  it('records a crossing only after the allotment is strictly above 90 percent', async () => {
    expect(passedAllotmentRatio(333, 370)).toBe(false);
    expect(passedAllotmentRatio(334, 370)).toBe(true);
    expect(passedAllotmentRatio(8, 10)).toBe(false);
    expect(passedAllotmentRatio(9, 10)).toBe(false);
    expect(passedAllotmentRatio(10, 10)).toBe(true);
    const almost = await recordCompletedSample({
      sampleId: 's-1',
      userId: 'user-a',
      allotted: 10,
      nowMs: 1_000,
    });
    expect(almost.crossing).toBeNull();
    let last = almost;
    for (let n = 2; n <= 10; n += 1) {
      last = await recordCompletedSample({
        sampleId: `s-${n}`,
        userId: 'user-a',
        allotted: 10,
        nowMs: 2_000,
      });
    }
    expect(last.crossing).toEqual({
      userId: 'user-a',
      subjectKey: 'user:user-a',
      manifestVersion: 'review-roster-370',
      allotted: 10,
      completed: 10,
      crossedAtMs: 2_000,
    });
    expect(last.pendingDelivery).toEqual(last.crossing);
    const again = await recordCompletedSample({
      sampleId: 's-11',
      userId: 'user-a',
      allotted: 10,
      nowMs: 3_000,
    });
    expect(again.crossing?.userId).toBe('user-a');
    expect(again.crossing?.crossedAtMs).toBe(2_000);
    const other = await recordCompletedSample({
      sampleId: 's-1',
      userId: 'user-b',
      allotted: 10,
      nowMs: 4_000,
    });
    expect(other.crossing).toBeNull();
    expect(other.completedIds).toEqual(['s-1']);
  });
});
