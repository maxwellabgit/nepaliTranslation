import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AuthStatusBanner } from '../AuthStatusBanner';
import { ServiceProvider } from '../../../services/ServiceContext';
import { createTestServices } from '../../../services/createTestServices';

jest.mock('../AuthProvider', () => ({
  useAuth: () => ({
    alert: null,
    error: null,
    clearAlert: jest.fn(),
  }),
}));

describe('AuthStatusBanner', () => {
  it('shows AuthService lastError accessibly', async () => {
    const services = createTestServices({
      authError: 'Could not reach the account server.',
    });
    await act(async () => {
      render(
        <ServiceProvider services={services}>
          <AuthStatusBanner />
        </ServiceProvider>,
      );
    });
    expect(screen.getByTestId('auth-status-banner')).toBeTruthy();
    expect(screen.getByTestId('auth-status-message').props.children).toBe(
      'Could not reach the account server.',
    );
    await fireEvent.press(screen.getByTestId('auth-status-dismiss'));
  });
});
