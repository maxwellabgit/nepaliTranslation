import { act, render, screen, waitFor, fireEvent } from '@testing-library/react-native';

import { AppProviders } from '../../app/AppProviders';
import { createTestServices } from '../../services/createTestServices';
import { SettingsScreen } from '../SettingsScreen';
import { Alert } from 'react-native';
import { recordContributionConsent } from '../../features/auth/recordConsent';
import { flushPendingDrafts } from '../../services/contributionSync';
jest.mock('../../features/auth/recordConsent', () => ({ recordContributionConsent: jest.fn() }));
jest.mock('../../services/contributionSync', () => ({ flushPendingDrafts: jest.fn() }));

const mockAccount = {
  status: 'signed-in',
  userId: '11111111-1111-4111-8111-111111111111',
  authConfigured: true,
  consentVersion: null,
  ageConfirmed: false,
  deletionRetryPending: false,
  deletionDueAt: null,
  deletionCompletedAt: null,
  ensureGuestIdentity: jest.fn(async () => true),
  retryIdentity: jest.fn(async () => true),
  deleteData: jest.fn(),
  refreshDataSummary: jest.fn(async () => undefined),
  clearAlert: jest.fn(),
};

jest.mock('../../features/auth/AuthProvider', () => ({
  ...jest.requireActual('../../features/auth/AuthProvider'),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
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


test.each(['delete', 'owner change'])('late consent success after %s cannot flush or refresh', async reason => {
  jest.clearAllMocks();
  mockAccount.userId = '11111111-1111-4111-8111-111111111111';
  mockAccount.deleteData.mockResolvedValue(undefined);
  mockAccount.ensureGuestIdentity.mockResolvedValue(true);
  let resolve!: (value: { ok: true }) => void;
  (recordContributionConsent as jest.Mock).mockReturnValue(new Promise(done => { resolve = done; }));
  const services = createTestServices({ authConfigured: true });
  const ui = () => <AppProviders services={services} bypassStartupConsent><SettingsScreen onClose={jest.fn()} /></AppProviders>;
  let view!: Awaited<ReturnType<typeof render>>;
  await act(async () => { view = await render(ui()); });
  await waitFor(() => expect(screen.getByTestId('privacy-data-section')).toBeTruthy());
  await fireEvent.press(screen.getByTestId('age-confirm'));
  await fireEvent.press(screen.getByTestId('model-improvement-opt-in'));
  await fireEvent.press(screen.getByTestId('save-consent'));
  await waitFor(() => expect(recordContributionConsent).toHaveBeenCalled());
  const owner = (recordContributionConsent as jest.Mock).mock.calls[0][0];
  const guard = (recordContributionConsent as jest.Mock).mock.calls[0][1];
  expect(owner).toBe(mockAccount.userId);
  expect(guard()).toBe(true);
  if (reason === 'delete') {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await fireEvent.press(screen.getByTestId('delete-shared-data'));
    await act(async () => { alert.mock.calls[0][2]?.find(action => action.style === 'destructive')?.onPress?.(); });
    alert.mockRestore();
  } else {
    mockAccount.userId = '22222222-2222-4222-8222-222222222222';
    await act(async () => { await view.rerender(ui()); });
  }
  expect(guard()).toBe(false);
  mockAccount.refreshDataSummary.mockClear();
  await act(async () => { resolve({ ok: true }); });
  expect(flushPendingDrafts).not.toHaveBeenCalled();
  expect(mockAccount.refreshDataSummary).not.toHaveBeenCalled();
});
