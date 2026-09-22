import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  americaNewYorkCalendarDay,
  clearForegroundAdTimerState,
  createForegroundAccumulator,
  loadForegroundActiveMs,
  loadInterstitialDayState,
  recordInterstitialPresentation,
  saveForegroundActiveMs,
} from '../foregroundAdTimer';
import {
  persistForegroundActiveMs,
  tryPresentInterstitial,
} from '../interstitialOpportunity';
import { createMockAdAdapter } from '../adMiddleware';
import { GOOGLE_TEST_INTERSTITIAL_UNIT } from '../adConfig';
import { INTERSTITIAL_MIN_FOREGROUND_MS } from '../../entitlements/decideInterstitialPresentation';

describe('foregroundAdTimer', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    await clearForegroundAdTimerState();
  });

  it('formats America/New_York calendar days (DST-safe key)', () => {
    // 2026-03-08 06:30 UTC = still 2026-03-08 early morning NY (EDT starts 02:00 local).
    const winter = Date.parse('2026-01-15T17:00:00.000Z');
    expect(americaNewYorkCalendarDay(winter)).toBe('2026-01-15');
    const summer = Date.parse('2026-07-15T16:00:00.000Z');
    expect(americaNewYorkCalendarDay(summer)).toBe('2026-07-15');
  });

  it('accumulates only active segments', () => {
    const acc = createForegroundAccumulator(0);
    acc.onActive(1_000);
    expect(acc.onInactive(1_000 + 5_000)).toBe(5_000);
    acc.onActive(10_000);
    expect(acc.flush(10_000 + 2_000)).toBe(7_000);
  });

  it('persists and loads foreground ms', async () => {
    await saveForegroundActiveMs(12_345);
    expect(await loadForegroundActiveMs()).toBe(12_345);
    await persistForegroundActiveMs(99);
    expect(await loadForegroundActiveMs()).toBe(99);
  });

  it('resets interstitial count across NY calendar days', async () => {
    const day1 = Date.parse('2026-06-01T18:00:00.000Z');
    await recordInterstitialPresentation(day1);
    await recordInterstitialPresentation(day1);
    expect((await loadInterstitialDayState(day1)).count).toBe(2);

    const day2 = Date.parse('2026-06-02T18:00:00.000Z');
    expect((await loadInterstitialDayState(day2)).count).toBe(0);
  });
});

describe('tryPresentInterstitial', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    await clearForegroundAdTimerState();
  });

  it('loads and shows interstitial when eligible', async () => {
    const adapter = createMockAdAdapter();
    const result = await tryPresentInterstitial({
      automaticInterstitialEnabled: true,
      hasSubscription: false,
      earnedAdFreeUntilMs: null,
      trustedNowMs: 1,
      offline: false,
      canRequestAds: true,
      appActive: true,
      transition: 'idle_after_task',
      surface: 'learn_landing',
      foregroundActiveMs: INTERSTITIAL_MIN_FOREGROUND_MS,
      presentationsTodayNy: 0,
      adapter,
      interstitialUnitId: GOOGLE_TEST_INTERSTITIAL_UNIT,
      nowMs: Date.now(),
    });
    expect(result.presented).toBe(true);
    expect(adapter.networkCalls().map((c) => c.kind)).toEqual([
      'interstitial_load',
      'interstitial_show',
    ]);
  });

  it('never touches the network when offline or flag off', async () => {
    const adapter = createMockAdAdapter();
    await tryPresentInterstitial({
      automaticInterstitialEnabled: false,
      hasSubscription: false,
      earnedAdFreeUntilMs: null,
      trustedNowMs: 1,
      offline: false,
      canRequestAds: true,
      transition: 'idle_after_task',
      surface: 'translate_idle',
      foregroundActiveMs: INTERSTITIAL_MIN_FOREGROUND_MS,
      presentationsTodayNy: 0,
      adapter,
      interstitialUnitId: GOOGLE_TEST_INTERSTITIAL_UNIT,
    });
    await tryPresentInterstitial({
      automaticInterstitialEnabled: true,
      hasSubscription: false,
      earnedAdFreeUntilMs: null,
      trustedNowMs: 1,
      offline: true,
      canRequestAds: true,
      transition: 'idle_after_task',
      surface: 'translate_idle',
      foregroundActiveMs: INTERSTITIAL_MIN_FOREGROUND_MS,
      presentationsTodayNy: 0,
      adapter,
      interstitialUnitId: GOOGLE_TEST_INTERSTITIAL_UNIT,
    });
    expect(adapter.networkCalls()).toEqual([]);
  });

  it('refuses missing interstitial unit id', async () => {
    const adapter = createMockAdAdapter();
    const result = await tryPresentInterstitial({
      automaticInterstitialEnabled: true,
      hasSubscription: false,
      earnedAdFreeUntilMs: null,
      trustedNowMs: 1,
      offline: false,
      canRequestAds: true,
      transition: 'idle_after_task',
      surface: 'learn_landing',
      foregroundActiveMs: INTERSTITIAL_MIN_FOREGROUND_MS,
      presentationsTodayNy: 0,
      adapter,
      interstitialUnitId: '',
    });
    expect(result.presented).toBe(false);
    expect(result.executed).toBe('none:missing_unit');
    expect(adapter.networkCalls()).toEqual([]);
  });
});
