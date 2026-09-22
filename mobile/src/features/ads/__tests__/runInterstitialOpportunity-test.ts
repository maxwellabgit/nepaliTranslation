import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearForegroundAdTimerState, saveForegroundActiveMs } from '../foregroundAdTimer';
import { runInterstitialOpportunity } from '../interstitialOpportunity';
import { createMockAdAdapter } from '../adMiddleware';
import { INTERSTITIAL_MIN_FOREGROUND_MS } from '../../entitlements/decideInterstitialPresentation';

describe('runInterstitialOpportunity', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    await clearForegroundAdTimerState();
    await saveForegroundActiveMs(INTERSTITIAL_MIN_FOREGROUND_MS);
  });

  it('presents when flag on and idle_after_task', async () => {
    const adapter = createMockAdAdapter();
    const result = await runInterstitialOpportunity({
      automaticInterstitialEnabled: true,
      offline: false,
      canRequestAds: true,
      appActive: true,
      earnedAdFreeUntilMs: null,
      trustedNowMs: 1,
      foregroundActiveMs: INTERSTITIAL_MIN_FOREGROUND_MS,
      adapter,
      req: { transition: 'idle_after_task', surface: 'learn_landing' },
    });
    expect(result.presented).toBe(true);
    expect(adapter.networkCalls().map((c) => c.kind)).toEqual([
      'interstitial_load',
      'interstitial_show',
    ]);
  });

  it('no-ops when flag off', async () => {
    const adapter = createMockAdAdapter();
    const result = await runInterstitialOpportunity({
      automaticInterstitialEnabled: false,
      offline: false,
      canRequestAds: true,
      appActive: true,
      earnedAdFreeUntilMs: null,
      trustedNowMs: 1,
      foregroundActiveMs: INTERSTITIAL_MIN_FOREGROUND_MS,
      adapter,
      req: { transition: 'idle_after_task', surface: 'learn_landing' },
    });
    expect(result).toEqual({ presented: false, executed: 'none:flag_off' });
    expect(adapter.networkCalls()).toEqual([]);
  });

  it('rejects tab_press without network', async () => {
    const adapter = createMockAdAdapter();
    const result = await runInterstitialOpportunity({
      automaticInterstitialEnabled: true,
      offline: false,
      canRequestAds: true,
      appActive: true,
      earnedAdFreeUntilMs: null,
      trustedNowMs: 1,
      foregroundActiveMs: INTERSTITIAL_MIN_FOREGROUND_MS,
      adapter,
      req: { transition: 'tab_press', surface: 'learn_landing' },
    });
    expect(result.presented).toBe(false);
    expect(adapter.networkCalls()).toEqual([]);
  });
});
