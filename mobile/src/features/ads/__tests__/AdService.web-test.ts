import { createProductionAdService } from '../AdService.web';

describe('AdService.web', () => {
  it('soft-fails all network methods without throwing', async () => {
    const ads = createProductionAdService();
    expect(ads.getConsentState().canRequestAds).toBe(false);
    await expect(ads.prepareConsentAndSdk()).resolves.toEqual({
      canRequestAds: false,
      privacyOptionsRequired: false,
    });
    await ads.showPrivacyOptions();
    await ads.adapter.loadBanner('b');
    await ads.adapter.showBanner('b');
    await ads.adapter.loadRewarded('r');
    await expect(ads.adapter.showRewarded('r')).resolves.toEqual({
      earned: false,
    });
    await ads.adapter.loadInterstitial('i');
    await ads.adapter.showInterstitial('i');
    ads.adapter.showHouseAd('learn_landing');
    expect(ads.networkCalls()).toEqual([]);
  });
});
