import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabase } from '../../../services/supabase';
import {
  acknowledgeAllotmentDelivery,
  allottedSampleCount,
  deliverSampleProgress,
  passedAllotmentRatio,
  readAllotmentState,
  recordCompletedSample,
} from '../sampleAllotment';

import { saveLocalConsent } from '../../../storage/contributionConsent';
import { setRuntimeFeatureFlags, DEFAULT_FEATURE_FLAGS } from '../../../app/featureFlags';
jest.mock('../../../services/supabase', () => ({
  getSupabase: jest.fn(() => null),
}));

const mockedGetSupabase = getSupabase as jest.MockedFunction<typeof getSupabase>;

describe('shipped review samples', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    await saveLocalConsent(true, 'user-a');
    setRuntimeFeatureFlags({ ...DEFAULT_FEATURE_FLAGS, contributionTextEnabled: true });
    mockedGetSupabase.mockReturnValue(null);
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

  it('does not queue a crossing again after it was acknowledged', async () => {
    for (let n = 1; n <= 10; n += 1) {
      await recordCompletedSample({
        sampleId: `s-${n}`,
        userId: 'user-a',
        allotted: 10,
        nowMs: 2_000,
      });
    }
    await acknowledgeAllotmentDelivery('user-a');
    const again = await recordCompletedSample({
      sampleId: 's-1',
      userId: 'user-a',
      allotted: 10,
      nowMs: 9_000,
    });
    expect(again.pendingDelivery).toBeNull();
    expect(again.crossing?.crossedAtMs).toBe(2_000);
    expect(await deliverSampleProgress('user-a')).toBe('skipped');
  });

  it('delivers a pending crossing once and leaves it pending when the server refuses', async () => {
    const rpc = jest.fn(async (): Promise<{ error: { message: string } | null }> => ({
      error: { message: 'rls' },
    }));
    mockedGetSupabase.mockReturnValue({ rpc, auth: { getSession: async () => ({ data: { session: { user: { id: 'user-a' }, access_token: 'tok' } } }) } } as never);
    for (let n = 1; n <= 10; n += 1) {
      await recordCompletedSample({
        sampleId: `m-${n}`,
        userId: 'user-a',
        allotted: 10,
        nowMs: 5_000,
      });
    }
    expect(await deliverSampleProgress('user-a')).toBe('pending');
    expect((await readAllotmentState('user-a')).pendingDelivery?.completed).toBe(10);
    rpc.mockResolvedValue({ error: null });
    expect(await deliverSampleProgress('user-a')).toBe('delivered');
    expect(rpc).toHaveBeenCalledTimes(2);
    expect((await readAllotmentState('user-a')).pendingDelivery).toBeNull();
    expect(await deliverSampleProgress('user-a')).toBe('skipped');
    mockedGetSupabase.mockReturnValue(null);
  });
});
