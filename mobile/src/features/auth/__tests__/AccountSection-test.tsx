import { Alert } from 'react-native';
import { render, fireEvent, screen } from '@testing-library/react-native';
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
  test('guest settings do not present a mandatory login wall', async () => {
    await render(
      <AccountSection {...base} status="guest" userId={null} />,
    );
    expect(screen.getByLabelText('Sign in with Apple')).toBeTruthy();
    expect(screen.queryByText(/required to translate/i)).toBeNull();
    expect(screen.queryByText(/settings still work/i)).toBeNull();
  });

  test('delete account explains that an Apple subscription is not cancelled', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await render(
      <AccountSection
        {...base}
        status="signed-in"
        userId="11111111-1111-4111-8111-111111111111"
      />,
    );
    await fireEvent.press(screen.getByTestId('delete-account'));
    expect(alertSpy).toHaveBeenCalledWith(
      'Delete account',
      expect.stringMatching(/does not cancel an Apple subscription/i),
      expect.any(Array),
    );
    expect(base.onDeleteAccount).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});
