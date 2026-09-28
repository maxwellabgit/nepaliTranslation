import { INTERSTITIAL_MIN_FOREGROUND_MS } from '../../entitlements/decideInterstitialPresentation';
import {
  formatInterstitialCountdown,
  interstitialAdsSuppressed,
  interstitialGauge,
} from '../interstitialGauge';

const open = {
  automaticInterstitialEnabled: true,
  hasSubscription: false,
  earnedAdFreeUntilMs: null,
  trustedNowMs: 1_000,
  offline: false,
  canRequestAds: true,
};

describe('interstitial gauge', () => {
  it('counts down the same 10-minute foreground budget the interstitial uses', () => {
    const gauge = interstitialGauge({
      foregroundActiveMs: 60_000,
      suppressed: false,
    });
    expect(gauge.state).toBe('countdown');
    expect(gauge.remainingMs).toBe(INTERSTITIAL_MIN_FOREGROUND_MS - 60_000);
    expect(formatInterstitialCountdown(gauge.remainingMs)).toBe('9:00');
  });

  it('shows ready at the eligibility threshold and again after a reset to zero', () => {
    expect(
      interstitialGauge({
        foregroundActiveMs: INTERSTITIAL_MIN_FOREGROUND_MS,
        suppressed: false,
      }).state,
    ).toBe('ready');
    const reset = interstitialGauge({
      foregroundActiveMs: 0,
      suppressed: false,
    });
    expect(reset.state).toBe('countdown');
    expect(formatInterstitialCountdown(reset.remainingMs)).toBe('10:00');
  });

  it('stays unavailable while ads are suppressed', () => {
    expect(interstitialAdsSuppressed(open)).toBe(false);
    expect(interstitialAdsSuppressed({ ...open, automaticInterstitialEnabled: false })).toBe(true);
    expect(interstitialAdsSuppressed({ ...open, hasSubscription: true })).toBe(true);
    expect(interstitialAdsSuppressed({ ...open, offline: true })).toBe(true);
    expect(interstitialAdsSuppressed({ ...open, canRequestAds: false })).toBe(true);
    expect(
      interstitialAdsSuppressed({
        ...open,
        earnedAdFreeUntilMs: 5_000,
        trustedNowMs: 1_000,
      }),
    ).toBe(true);
    expect(
      interstitialGauge({
        foregroundActiveMs: INTERSTITIAL_MIN_FOREGROUND_MS,
        suppressed: true,
      }).state,
    ).toBe('unavailable');
  });
});
