import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { AppProviders } from '../../app/AppProviders';
import { createTestServices } from '../../services/createTestServices';
import { CreditsGauge } from '../CreditsGauge';

function renderGauge(opts: Parameters<typeof createTestServices>[0] = {}) {
  const services = createTestServices({ offline: false, canRequestAds: true, ...opts });
  return render(
    <AppProviders services={services} bypassStartupConsent>
      <CreditsGauge compact />
    </AppProviders>,
  );
}

describe('CreditsGauge interstitial status', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('shows ads off while the automatic interstitial is disabled', async () => {
    await act(async () => {
      renderGauge();
    });
    expect(screen.getByTestId('credits-ad-countdown').props.children).toBe('Ads off');
  });

  it('counts the shared foreground clock when interstitials are enabled', async () => {
    await act(async () => {
      renderGauge({
        flags: { automaticInterstitialEnabled: true },
      });
    });
    await waitFor(() => {
      expect(screen.getByTestId('credits-ad-countdown').props.children).toMatch(/^(?:10:00|9:5\d)$/);
    }, { timeout: 4000 });
  });
});
