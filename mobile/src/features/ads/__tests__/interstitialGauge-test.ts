import { INTERSTITIAL_MIN_FOREGROUND_MS } from '../../entitlements/decideInterstitialPresentation';
import {
  formatInterstitialCountdown,
  interstitialAdsSuppressed,
  interstitialGauge,
  interstitialInterruptDue,
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

  it('reaches 0:00 at the eligibility threshold and 10:00 after a reset', () => {
    expect(
      interstitialGauge({
        foregroundActiveMs: INTERSTITIAL_MIN_FOREGROUND_MS,
        suppressed: false,
      }),
    ).toEqual({ state: 'countdown', remainingMs: 0 });
    const reset = interstitialGauge({
      foregroundActiveMs: 0,
      suppressed: false,
    });
    expect(reset.state).toBe('countdown');
    expect(formatInterstitialCountdown(reset.remainingMs)).toBe('10:00');
  });

  it('interrupts only when the countdown is at zero and ads are allowed', () => {
    expect(
      interstitialInterruptDue({
        ...open,
        foregroundActiveMs: INTERSTITIAL_MIN_FOREGROUND_MS - 1,
      }),
    ).toBe(false);
    expect(
      interstitialInterruptDue({
        ...open,
        foregroundActiveMs: INTERSTITIAL_MIN_FOREGROUND_MS,
      }),
    ).toBe(true);
    expect(
      interstitialInterruptDue({
        ...open,
        foregroundActiveMs: INTERSTITIAL_MIN_FOREGROUND_MS,
        earnedAdFreeUntilMs: 5_000,
        trustedNowMs: 1_000,
      }),
    ).toBe(false);
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
