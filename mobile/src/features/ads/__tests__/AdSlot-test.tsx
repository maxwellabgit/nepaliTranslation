import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AdSlot } from '../AdSlot';
import { createMockAdAdapter } from '../adMiddleware';
import { ServiceProvider } from '../../../services/ServiceContext';
import { createTestServices } from '../../../services/createTestServices';
import { GOOGLE_TEST_BANNER_UNIT } from '../adConfig';

const entitlementMock = {
  earnedAdFreeUntilMs: null as number | null,
  trustedNow: () => 1_000,
  hasActiveEarnedAdFree: () => false,
};

jest.mock('../../entitlements/EntitlementProvider', () => ({
  useEntitlementOptional: () => entitlementMock,
}));

jest.mock('../../../app/FeatureConfigProvider', () => ({
  useFeatureFlags: () => ({
    networkAdsEnabled: true,
    rewardedAdsEnabled: false,
    contributionsEnabled: false,
    rewardsEnabled: false,
    paywallEnabled: false,
    learnEnabled: true,
  }),
}));

describe('AdSlot', () => {
  beforeEach(() => {
    entitlementMock.earnedAdFreeUntilMs = null;
    entitlementMock.hasActiveEarnedAdFree = () => false;
  });
  test('renders house ad when offline', async () => {
    const adapter = createMockAdAdapter();
    const services = createTestServices({ offline: true, canRequestAds: true });
    services.ads.adapter = adapter;

    await act(async () => {
      render(
        <ServiceProvider services={services}>
          <AdSlot surface="translate_result" adapter={adapter} eligible />
        </ServiceProvider>,
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('house-ad-not-now')).toBeTruthy();
    });
    expect(adapter.networkCalls()).toEqual([]);
  });

  test('renders banner when online and consent granted', async () => {
    const adapter = createMockAdAdapter();
    const onShown = jest.fn();
    const services = createTestServices({ offline: false, canRequestAds: true });
    services.ads.adapter = adapter;

    await act(async () => {
      render(
        <ServiceProvider services={services}>
          <AdSlot
            surface="translate_result"
            adapter={adapter}
            eligible
            offline={false}
            canRequestAds
            onShown={onShown}
          />
        </ServiceProvider>,
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('ad-slot-banner-translate_result')).toBeTruthy();
    });
    expect(onShown).toHaveBeenCalledWith('banner');
    expect(adapter.networkCalls().length).toBeGreaterThan(0);
  });

  test('dismisses house ad via Not now', async () => {
    const adapter = createMockAdAdapter();
    const onDismiss = jest.fn();
    const services = createTestServices({ offline: true, canRequestAds: true });
    services.ads.adapter = adapter;

    await act(async () => {
      render(
        <ServiceProvider services={services}>
          <AdSlot
            surface="translate_result"
            adapter={adapter}
            eligible
            onDismissHouse={onDismiss}
          />
        </ServiceProvider>,
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('house-ad-not-now')).toBeTruthy();
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('house-ad-not-now'));
    });
    expect(onDismiss).toHaveBeenCalled();
    expect(screen.queryByTestId('house-ad-not-now')).toBeNull();
  });

  test('returns null when not eligible', async () => {
    const adapter = createMockAdAdapter();
    await act(async () => {
      render(
        <AdSlot surface="translate_result" adapter={adapter} eligible={false} />,
      );
    });
    await waitFor(() => {
      expect(screen.queryByTestId('ad-slot-banner-translate_result')).toBeNull();
    });
    expect(adapter.networkCalls()).toEqual([]);
    expect(GOOGLE_TEST_BANNER_UNIT).toBeTruthy();
  });

  test('suppresses ads when provisional/earned ad-free is active', async () => {
    entitlementMock.hasActiveEarnedAdFree = () => true;
    const adapter = createMockAdAdapter();
    const services = createTestServices({
      offline: true,
      canRequestAds: true,
      flags: { networkAdsEnabled: true },
    });
    services.ads.adapter = adapter;
    await act(async () => {
      render(
        <ServiceProvider services={services}>
          <AdSlot surface="translate_result" adapter={adapter} eligible />
        </ServiceProvider>,
      );
    });
    await waitFor(() => {
      expect(screen.queryByTestId('ad-slot-house-translate_result')).toBeNull();
    });
    expect(adapter.networkCalls()).toEqual([]);
  });
});
