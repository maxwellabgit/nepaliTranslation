import { decideAdPresentation } from '../../entitlements/decideAdPresentation';
import { INTERSTITIAL_MIN_FOREGROUND_MS, decideInterstitialPresentation } from '../../entitlements/decideInterstitialPresentation';

describe('subscription suppresses ads', () => {
  it('banner and interstitial stay off when hasSubscription', () => {
    expect(
      decideAdPresentation({
        surface: 'translate_idle',
        networkAdsEnabled: true,
        hasSubscription: true,
        earnedAdFreeUntilMs: null,
        trustedNowMs: 1,
        offline: false,
        canRequestAds: true,
        nowMs: 1,
      }),
    ).toEqual({ show: false, reason: 'subscription' });

    expect(
      decideInterstitialPresentation({
        automaticInterstitialEnabled: true,
        hasSubscription: true,
        earnedAdFreeUntilMs: null,
        trustedNowMs: 1,
        offline: false,
        canRequestAds: true,
        transition: 'idle_after_task',
        surface: 'learn_landing',
        foregroundActiveMs: INTERSTITIAL_MIN_FOREGROUND_MS,
        presentationsTodayNy: 0,
      }),
    ).toEqual({ show: false, reason: 'subscription' });
  });
});
