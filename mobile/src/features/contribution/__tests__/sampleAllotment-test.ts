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

  it('records the user once they pass 90 percent of the allotment', async () => {
    expect(passedAllotmentRatio(8, 10)).toBe(false);
    expect(passedAllotmentRatio(9, 10)).toBe(true);
    const almost = await recordCompletedSample({
      sampleId: 's-1',
      userId: 'user-a',
      allotted: 10,
      nowMs: 1_000,
    });
    expect(almost.crossing).toBeNull();
    let last = almost;
    for (let n = 2; n <= 9; n += 1) {
      last = await recordCompletedSample({
        sampleId: `s-${n}`,
        userId: 'user-a',
        allotted: 10,
        nowMs: 2_000,
      });
    }
    expect(last.crossing).toEqual({
      userId: 'user-a',
      allotted: 10,
      completed: 9,
      crossedAtMs: 2_000,
    });
    const again = await recordCompletedSample({
      sampleId: 's-10',
      userId: 'someone-else',
      allotted: 10,
      nowMs: 3_000,
    });
    expect(again.crossing?.userId).toBe('user-a');
    expect(again.completedIds).toHaveLength(10);
  });
});
