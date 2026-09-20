import { decideAdPresentation } from '../decideAdPresentation';

describe('decideAdPresentation', () => {
  const base = {
    networkAdsEnabled: true,
    hasSubscription: false,
    earnedAdFreeUntilMs: null as number | null,
    trustedNowMs: 1_000,
    offline: false,
  };

  it('never shows on conversation, keyboard, audio, or translating', () => {
    for (const surface of [
      'conversation',
      'keyboard',
      'audio',
      'translating',
    ] as const) {
      expect(decideAdPresentation({ ...base, surface })).toEqual({
        show: false,
        reason: 'blocked_surface',
      });
    }
  });

  it('hides for subscription and earned ad-free', () => {
    expect(
      decideAdPresentation({
        ...base,
        surface: 'home',
        hasSubscription: true,
      }),
    ).toEqual({ show: false, reason: 'subscription' });
    expect(
      decideAdPresentation({
        ...base,
        surface: 'home',
        earnedAdFreeUntilMs: 2_000,
      }),
    ).toEqual({ show: false, reason: 'earned_ad_free' });
  });

  it('uses house ads offline and banner online when allowed', () => {
    expect(
      decideAdPresentation({ ...base, surface: 'history', offline: true }),
    ).toEqual({ show: true, kind: 'house' });
    expect(decideAdPresentation({ ...base, surface: 'settings' })).toEqual({
      show: true,
      kind: 'banner',
    });
  });

  it('respects feature flag off', () => {
    expect(
      decideAdPresentation({
        ...base,
        surface: 'learn',
        networkAdsEnabled: false,
      }),
    ).toEqual({ show: false, reason: 'flag_off' });
  });

  it('does not treat unknown trusted time as earned ad-free', () => {
    expect(
      decideAdPresentation({
        ...base,
        surface: 'home',
        earnedAdFreeUntilMs: 9_999_999,
        trustedNowMs: null,
      }),
    ).toEqual({ show: true, kind: 'banner' });
  });
});
