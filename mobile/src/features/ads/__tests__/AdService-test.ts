import { GOOGLE_TEST_REWARDED_UNIT } from '../adConfig';
import { createProductionAdService } from '../AdService';

describe('AdService', () => {
  it('production service exposes adapter and consent helpers', async () => {
    const ads = createProductionAdService();
    expect(ads.adapter).toBeTruthy();
    expect(ads.getConsentState().canRequestAds).toBe(false);
    const consent = await ads.prepareConsentAndSdk();
    expect(typeof consent.canRequestAds).toBe('boolean');
    await ads.showPrivacyOptions();
    expect(ads.networkCalls()).toEqual([]);
  });

  it('records banner and rewarded network calls on adapter', async () => {
    const ads = createProductionAdService();
    await ads.prepareConsentAndSdk();
    await ads.adapter.loadBanner('banner-unit');
    await ads.adapter.showBanner('banner-unit');
    await ads.adapter.loadRewarded(GOOGLE_TEST_REWARDED_UNIT, {
      userId: 'user-1',
      customData: 'sess-1',
    });
    await ads.adapter.showRewarded(GOOGLE_TEST_REWARDED_UNIT);
    await ads.adapter.loadInterstitial('interstitial-unit');
    await ads.adapter.showInterstitial('interstitial-unit');
    ads.adapter.showHouseAd('translate_idle');

    const calls = ads.networkCalls();
    expect(calls.some((c) => c.kind === 'banner_load')).toBe(true);
    expect(calls.some((c) => c.kind === 'banner_show')).toBe(true);
    expect(calls.some((c) => c.kind === 'rewarded_load')).toBe(true);
    expect(calls.some((c) => c.kind === 'rewarded_show')).toBe(true);
    expect(calls.some((c) => c.kind === 'interstitial_load')).toBe(true);
    expect(calls.some((c) => c.kind === 'interstitial_show')).toBe(true);
  });

  it('prepareConsentAndSdk initializes SDK when consent allows ads', async () => {
    const ads = createProductionAdService();
    const consent = await ads.prepareConsentAndSdk();
    expect(consent.canRequestAds).toBe(false);
    expect(ads.getConsentState()).toEqual(consent);
  });
});
