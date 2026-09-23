import {
  decideInterstitialPresentation,
  INTERSTITIAL_MIN_FOREGROUND_MS,
} from '../decideInterstitialPresentation';

describe('decideInterstitialPresentation', () => {
  const base = {
    automaticInterstitialEnabled: true,
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
    resultUnderReview: false,
    cameraActive: false,
    transition: 'translate_send_committed' as const,
    surface: 'translate_idle' as const,
    foregroundActiveMs: INTERSTITIAL_MIN_FOREGROUND_MS,
    presentationsTodayNy: 0,
  };

  it('shows when all gates pass', () => {
    expect(decideInterstitialPresentation(base)).toEqual({ show: true });
  });

  it('requires remote flag', () => {
    expect(
      decideInterstitialPresentation({
        ...base,
        automaticInterstitialEnabled: false,
      }),
    ).toEqual({ show: false, reason: 'flag_off' });
  });

  it('suppresses for subscription and earned ad-free', () => {
    expect(
      decideInterstitialPresentation({ ...base, hasSubscription: true }),
    ).toEqual({ show: false, reason: 'subscription' });
    expect(
      decideInterstitialPresentation({
        ...base,
        earnedAdFreeUntilMs: 20_000,
      }),
    ).toEqual({ show: false, reason: 'earned_ad_free' });
  });

  it('never calls network while offline or UMP-blocked', () => {
    expect(decideInterstitialPresentation({ ...base, offline: true })).toEqual({
      show: false,
      reason: 'offline',
    });
    expect(
      decideInterstitialPresentation({ ...base, canRequestAds: false }),
    ).toEqual({ show: false, reason: 'ump_blocks' });
  });

  it('forbids launch, resume, tab, camera, result review, and busy chrome', () => {
    for (const transition of [
      'launch',
      'exit',
      'resume',
      'tab_press',
      'permission',
      'error_recovery',
      'camera',
      'result_review',
    ] as const) {
      expect(
        decideInterstitialPresentation({ ...base, transition }),
      ).toMatchObject({ show: false });
    }
    expect(
      decideInterstitialPresentation({ ...base, cameraActive: true }),
    ).toEqual({ show: false, reason: 'camera' });
    expect(
      decideInterstitialPresentation({ ...base, resultUnderReview: true }),
    ).toEqual({ show: true });
    expect(
      decideInterstitialPresentation({ ...base, modalVisible: true }),
    ).toEqual({ show: false, reason: 'modal' });
    expect(
      decideInterstitialPresentation({ ...base, keyboardVisible: true }),
    ).toEqual({ show: false, reason: 'keyboard' });
    expect(
      decideInterstitialPresentation({ ...base, listening: true }),
    ).toEqual({ show: false, reason: 'audio' });
    expect(
      decideInterstitialPresentation({ ...base, translating: true }),
    ).toEqual({ show: false, reason: 'translating' });
  });

  it('enforces the 15-minute foreground gate and has no daily cap', () => {
    expect(
      decideInterstitialPresentation({
        ...base,
        foregroundActiveMs: INTERSTITIAL_MIN_FOREGROUND_MS - 1,
      }),
    ).toEqual({ show: false, reason: 'foreground_gate' });
    expect(
      decideInterstitialPresentation({
        ...base,
        presentationsTodayNy: 99,
      }),
    ).toEqual({ show: true });
  });

  it('allows only the three committed safe points', () => {
    for (const transition of [
      'translate_send_committed',
      'camera_capture_committed',
      'learn_activity_completed',
    ] as const) {
      expect(
        decideInterstitialPresentation({ ...base, transition }),
      ).toEqual({ show: true });
    }
    expect(
      decideInterstitialPresentation({
        ...base,
        transition: 'idle_after_task',
      }),
    ).toEqual({ show: false, reason: 'transition_idle_after_task' });
  });

  it('allows learn_landing surface', () => {
    expect(
      decideInterstitialPresentation({
        ...base,
        surface: 'learn_landing',
      }),
    ).toEqual({ show: true });
  });
});
