import { decideAdPresentation } from '../../entitlements/decideAdPresentation';

describe('decideAdPresentation H6 priorities', () => {
  const base = {
    networkAdsEnabled: true,
    rewardedAdsEnabled: true,
    hasSubscription: false,
    earnedAdFreeUntilMs: null as number | null,
    trustedNowMs: 10_000,
    offline: false,
    canRequestAds: true,
    appActive: true,
    modalVisible: false,
    keyboardVisible: false,
    listening: false,
    speaking: false,
    translating: false,
    lastNetworkBannerAtMs: null as number | null,
    lastHouseBannerAtMs: null as number | null,
    nowMs: 10_000,
    surface: 'translate_idle' as const,
  };

  it('subscription or earned window → none', () => {
    expect(
      decideAdPresentation({ ...base, hasSubscription: true }),
    ).toEqual({ show: false, reason: 'subscription' });
    expect(
      decideAdPresentation({
        ...base,
        earnedAdFreeUntilMs: 20_000,
      }),
    ).toEqual({ show: false, reason: 'earned_ad_free' });
  });

  it('inactive / modal / keyboard / audio / translating / conversation → none', () => {
    expect(decideAdPresentation({ ...base, appActive: false })).toEqual({
      show: false,
      reason: 'inactive',
    });
    expect(decideAdPresentation({ ...base, modalVisible: true })).toEqual({
      show: false,
      reason: 'modal',
    });
    expect(decideAdPresentation({ ...base, keyboardVisible: true })).toEqual({
      show: false,
      reason: 'keyboard',
    });
    expect(decideAdPresentation({ ...base, listening: true })).toEqual({
      show: false,
      reason: 'audio',
    });
    expect(decideAdPresentation({ ...base, translating: true })).toEqual({
      show: false,
      reason: 'translating',
    });
    expect(
      decideAdPresentation({ ...base, surface: 'conversation' }),
    ).toEqual({ show: false, reason: 'conversation' });
  });

  it('offline house with 24-minute cooldown', () => {
    expect(decideAdPresentation({ ...base, offline: true })).toEqual({
      show: true,
      kind: 'house',
    });
    expect(
      decideAdPresentation({
        ...base,
        offline: true,
        lastHouseBannerAtMs: 10_000 - 60_000,
        nowMs: 10_000,
      }),
    ).toEqual({ show: false, reason: 'house_cooldown' });
  });

  it('UMP blocks → house online', () => {
    expect(
      decideAdPresentation({ ...base, canRequestAds: false }),
    ).toEqual({ show: true, kind: 'house' });
  });

  it('eligible online banner with 12-minute cooldown', () => {
    expect(decideAdPresentation(base)).toEqual({ show: true, kind: 'banner' });
    expect(
      decideAdPresentation({
        ...base,
        lastNetworkBannerAtMs: 10_000 - 60_000,
        nowMs: 10_000,
      }),
    ).toEqual({ show: false, reason: 'banner_cooldown' });
  });

  it('rewarded only after explicit tap', () => {
    expect(
      decideAdPresentation({
        ...base,
        explicitRewardedRequest: true,
      }),
    ).toEqual({ show: true, kind: 'rewarded' });
    expect(
      decideAdPresentation({
        ...base,
        explicitRewardedRequest: true,
        offline: true,
      }),
    ).toEqual({ show: false, reason: 'rewarded_offline' });
  });

  it('disallows result-review and contribution placements', () => {
    expect(
      decideAdPresentation({ ...base, surface: 'translate_result' }),
    ).toEqual({ show: false, reason: 'placement' });
    expect(
      decideAdPresentation({ ...base, surface: 'contribution_result' }),
    ).toEqual({ show: false, reason: 'placement' });
    expect(decideAdPresentation({ ...base, surface: 'home' })).toEqual({
      show: false,
      reason: 'placement',
    });
    expect(decideAdPresentation({ ...base, surface: 'quiz' })).toEqual({
      show: false,
      reason: 'quiz',
    });
  });

  it('allows learn_landing', () => {
    expect(
      decideAdPresentation({ ...base, surface: 'learn_landing' }),
    ).toEqual({ show: true, kind: 'banner' });
  });

  it('unknown trusted time does not suppress as earned', () => {
    expect(
      decideAdPresentation({
        ...base,
        earnedAdFreeUntilMs: 9_999_999,
        trustedNowMs: null,
      }),
    ).toEqual({ show: true, kind: 'banner' });
  });
});
