import { act, render, screen, waitFor } from '@testing-library/react-native';

import { AppProviders } from '../../app/AppProviders';
import { createTestServices } from '../../services/createTestServices';
import { SettingsScreen } from '../SettingsScreen';

const mockAccount = {
  status: 'signed-in',
  userId: '11111111-1111-4111-8111-111111111111',
  authConfigured: true,
  consentVersion: null,
  ageConfirmed: false,
  deletionRetryPending: false,
  deletionDueAt: null,
  deletionCompletedAt: null,
  signInWithApple: jest.fn(),
  signOut: jest.fn(),
  deleteAccount: jest.fn(),
  refreshAccountSummary: jest.fn(async () => undefined),
  clearAlert: jest.fn(),
};

jest.mock('../../features/auth/AuthProvider', () => ({
  ...jest.requireActual('../../features/auth/AuthProvider'),
  useAuth: () => mockAccount,
}));

test('a signed-in tester can reach the optional rewarded ad from Settings', async () => {
  const services = createTestServices({
    authConfigured: true,
    offline: false,
    canRequestAds: true,
    flags: { networkAdsEnabled: true, rewardedAdsEnabled: true },
  });
  await act(async () => {
    render(
      <AppProviders services={services} bypassStartupConsent>
        <SettingsScreen onClose={jest.fn()} />
      </AppProviders>,
    );
  });
  await waitFor(() => expect(screen.getByTestId('rewarded-ad-cta')).toBeTruthy());
});
