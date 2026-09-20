import {
  createMockAdAdapter,
  executeAdPlan,
  planAdPlacement,
  verifyAdmobSsvShape,
} from '../adMiddleware';

describe('adMiddleware', () => {
  const base = {
    networkAdsEnabled: true,
    hasSubscription: false,
    earnedAdFreeUntilMs: null as number | null,
    trustedNowMs: 1_000 as number | null,
    bannerUnitId: 'ca-app-pub-test/banner',
  };

  it('never schedules network AdMob calls while offline', async () => {
    const adapter = createMockAdAdapter();
    const plan = planAdPlacement({
      ...base,
      surface: 'home',
      offline: true,
    });
    expect(plan).toEqual({ action: 'house', surface: 'home' });
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
        surface: 'history',
        offline: false,
        hasSubscription: true,
      }),
      adapter,
    );
    await executeAdPlan(
      planAdPlacement({
        ...base,
        surface: 'settings',
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
    const plan = planAdPlacement({ ...base, surface: 'learn', offline: false });
    expect(plan).toEqual({
      action: 'banner',
      unitId: 'ca-app-pub-test/banner',
    });
    await executeAdPlan(plan, adapter);
    expect(adapter.networkCalls().map((c) => c.kind)).toEqual([
      'banner_load',
      'banner_show',
    ]);
  });

  it('validates AdMob SSV fixture shape without trusting the client', () => {
    expect(
      verifyAdmobSsvShape({
        ad_network: '5450213213286189855',
        ad_unit: '123',
        reward_amount: '1',
        reward_item: 'credit',
        timestamp: '1700000000',
        transaction_id: 'tx1',
        user_id: 'u1',
        signature: 'sig',
        key_id: '1',
      }).ok,
    ).toBe(true);
    expect(verifyAdmobSsvShape({ ad_network: 'x' }).ok).toBe(false);
  });
});
