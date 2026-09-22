import {
  createMockAdAdapter,
  executeAdPlan,
  planAdPlacement,
} from '../adMiddleware';
import { GOOGLE_TEST_BANNER_UNIT, GOOGLE_TEST_REWARDED_UNIT } from '../adConfig';

describe('adMiddleware', () => {
  const base = {
    networkAdsEnabled: true,
    hasSubscription: false,
    earnedAdFreeUntilMs: null as number | null,
    trustedNowMs: 1_000 as number | null,
    bannerUnitId: GOOGLE_TEST_BANNER_UNIT,
    rewardedUnitId: GOOGLE_TEST_REWARDED_UNIT,
    canRequestAds: true,
    nowMs: 1_000,
    surface: 'translate_idle' as const,
  };

  it('never schedules network AdMob calls while offline', async () => {
    const adapter = createMockAdAdapter();
    const plan = planAdPlacement({
      ...base,
      offline: true,
    });
    expect(plan).toEqual({ action: 'house', surface: 'translate_idle' });
    await executeAdPlan(plan, adapter);
    expect(adapter.networkCalls()).toEqual([]);
  });

  it('blocks conversation, keyboard, audio, and translating surfaces', async () => {
    const adapter = createMockAdAdapter();
    for (const surface of [
      'conversation',
      'keyboard',
      'audio',
      'translating',
    ] as const) {
      const plan = planAdPlacement({ ...base, surface, offline: false });
      expect(plan.action).toBe('none');
      await executeAdPlan(plan, adapter);
    }
    expect(adapter.networkCalls()).toEqual([]);
  });

  it('hides ads under subscription or earned ad-free', async () => {
    const adapter = createMockAdAdapter();
    await executeAdPlan(
      planAdPlacement({
        ...base,
        offline: false,
        hasSubscription: true,
      }),
      adapter,
    );
    await executeAdPlan(
      planAdPlacement({
        ...base,
        offline: false,
        earnedAdFreeUntilMs: 5_000,
        trustedNowMs: 1_000,
      }),
      adapter,
    );
    expect(adapter.networkCalls()).toEqual([]);
  });

  it('loads a banner online when allowed', async () => {
    const adapter = createMockAdAdapter();
    const plan = planAdPlacement({
      ...base,
      surface: 'learn_landing',
      offline: false,
    });
    expect(plan).toEqual({
      action: 'banner',
      unitId: GOOGLE_TEST_BANNER_UNIT,
    });
    await executeAdPlan(plan, adapter);
    expect(adapter.networkCalls().map((c) => c.kind)).toEqual([
      'banner_load',
      'banner_show',
    ]);
  });

  it('rewarded plan requires explicit request and never runs offline', async () => {
    const adapter = createMockAdAdapter();
    const plan = planAdPlacement({
      ...base,
      offline: false,
      rewardedAdsEnabled: true,
      explicitRewardedRequest: true,
    });
    expect(plan.action).toBe('rewarded');
    await executeAdPlan(plan, adapter, {
      userId: 'u1',
      customData: 'sess',
    });
    expect(adapter.networkCalls().map((c) => c.kind)).toEqual([
      'rewarded_load',
      'rewarded_show',
    ]);

    const offline = planAdPlacement({
      ...base,
      offline: true,
      rewardedAdsEnabled: true,
      explicitRewardedRequest: true,
    });
    expect(offline.action).toBe('none');
    await executeAdPlan(offline, adapter);
    expect(adapter.networkCalls().length).toBe(2);
  });
});
