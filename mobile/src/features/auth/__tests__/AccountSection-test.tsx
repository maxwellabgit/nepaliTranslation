import { Alert } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { render, fireEvent, screen, waitFor, act } from '@testing-library/react-native';
import { AccountSection } from '../AccountSection';

const base = {
  authConfigured: true,
  consentVersion: null,
  ageConfirmed: false,
  onSignIn: jest.fn(),
  onSignOut: jest.fn(),
  onSaveConsent: jest.fn(),
  onDeleteAccount: jest.fn(),
};

describe('AccountSection', () => {
  beforeEach(() => {
    (AppleAuthentication.isAvailableAsync as jest.Mock).mockResolvedValue(true);
  });

  test('guest settings do not present a mandatory login wall', async () => {
    await act(async () => {
      render(<AccountSection {...base} status="guest" userId={null} />);
    });
    await waitFor(() => {
      expect(screen.getByTestId('sign-in-apple')).toBeTruthy();
    });
    expect(screen.getByLabelText('Sign in with Apple')).toBeTruthy();
    expect(screen.queryByText(/required to translate/i)).toBeNull();
    expect(screen.queryByText(/settings still work/i)).toBeNull();
  });

  test('renders official Apple button when Apple auth is available', async () => {
    (AppleAuthentication.isAvailableAsync as jest.Mock).mockResolvedValue(true);
    await act(async () => {
      render(<AccountSection {...base} status="guest" userId={null} />);
    });
    await waitFor(() => {
      expect(screen.getByTestId('apple-auth-button')).toBeTruthy();
    });
    expect(screen.queryByTestId('apple-unavailable')).toBeNull();
  });

  test('hides Apple button when Apple auth is unavailable', async () => {
    (AppleAuthentication.isAvailableAsync as jest.Mock).mockResolvedValue(false);
    await act(async () => {
      render(<AccountSection {...base} status="guest" userId={null} />);
    });
    await waitFor(() => {
      expect(screen.getByTestId('apple-unavailable')).toBeTruthy();
    });
    expect(screen.queryByTestId('sign-in-apple')).toBeNull();
    expect(screen.queryByTestId('apple-auth-button')).toBeNull();
  });

  test('delete account explains that an Apple subscription is not cancelled', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await act(async () => {
      render(
        <AccountSection
          {...base}
          status="signed-in"
          userId="11111111-1111-4111-8111-111111111111"
        />,
      );
    });
    await fireEvent.press(screen.getByTestId('delete-account'));
    expect(alertSpy).toHaveBeenCalledWith(
      'Delete account',
      expect.stringMatching(/does not cancel an Apple subscription/i),
      expect.any(Array),
    );
    expect(base.onDeleteAccount).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  test('shows retry deletion control when deletion is paused', async () => {
    await act(async () => {
      render(
        <AccountSection
          {...base}
          status="signed-in"
          userId="11111111-1111-4111-8111-111111111111"
          deletionRetryPending
        />,
      );
    });
    expect(screen.getByTestId('retry-delete-account')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('retry-delete-account'));
    expect(base.onDeleteAccount).toHaveBeenCalled();
  });
});
