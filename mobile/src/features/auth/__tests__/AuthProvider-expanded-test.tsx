import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { AuthProvider, useAuth } from '../AuthProvider';
import { getSupabase } from '../../../services/supabase';
import { performAccountDeletion } from '../deleteAccount';
import { fetchAccountSummary } from '../accountSummary';

jest.mock('../deleteAccount', () => ({
  performAccountDeletion: jest.fn(),
}));

jest.mock('../accountSummary', () => ({
  fetchAccountSummary: jest.fn(),
}));

const mockPerformDeletion = performAccountDeletion as jest.Mock;
const mockFetchSummary = fetchAccountSummary as jest.Mock;

function AuthProbe() {
  const auth = useAuth();
  return (
    <>
      <Text testID="status">{auth.status}</Text>
      <Text testID="user">{auth.userId ?? 'none'}</Text>
      <Text testID="consent">{auth.consentVersion ?? 'none'}</Text>
      <Text testID="alert">{auth.alert ?? 'none'}</Text>
      <Text testID="retry">{String(auth.deletionRetryPending)}</Text>
      <Pressable
        testID="do-signin"
        onPress={() => {
          void auth.signInWithApple();
        }}
      />
      <Pressable
        testID="do-signout"
        onPress={() => {
          void auth.signOut();
        }}
      />
      <Pressable
        testID="do-delete"
        onPress={() => {
          void auth.deleteAccount();
        }}
      />
    </>
  );
}

function makeSupabase(overrides: Record<string, unknown> = {}) {
  return {
    auth: {
      getSession: jest.fn(async () => ({
        data: { session: null },
        error: null,
      })),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
      signOut: jest.fn(async () => undefined),
      signInWithIdToken: jest.fn(),
      updateUser: jest.fn(async () => undefined),
      ...overrides,
    },
  };
}

describe('AuthProvider flows', () => {
  beforeEach(() => {
    mockPerformDeletion.mockReset();
    mockFetchSummary.mockReset();
    mockFetchSummary.mockResolvedValue({
      ok: true,
      summary: {
        consentVersion: '2026-09-19.draft',
        ageConfirmed: true,
        receiptCount: 0,
        lifetimeCredits: 0,
        earnedAdFreeUntil: null,
      },
    });
    (AppleAuthentication.addRevokeListener as jest.Mock).mockImplementation(() => ({
      remove: jest.fn(),
    }));
  });

  test('no supabase initializes as guest', async () => {
    (getSupabase as jest.Mock).mockReturnValue(null);
    await act(async () => {
      render(
        <AuthProvider>
          <AuthProbe />
        </AuthProvider>,
      );
    });
    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('guest');
    });
  });

  test('restores session on mount and refreshes account summary', async () => {
    (getSupabase as jest.Mock).mockReturnValue(
      makeSupabase({
        getSession: jest.fn(async () => ({
          data: {
            session: { user: { id: 'user-1', user_metadata: {} }, access_token: 't' },
          },
          error: null,
        })),
      }),
    );
    await act(async () => {
      render(
        <AuthProvider>
          <AuthProbe />
        </AuthProvider>,
      );
    });
    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('signed-in');
    });
    await waitFor(() => {
      expect(screen.getByTestId('consent').props.children).toBe('2026-09-19.draft');
    });
    expect(mockFetchSummary).toHaveBeenCalled();
  });

  test('signInWithApple succeeds and updates session', async () => {
    const supabase = makeSupabase();
    supabase.auth.signInWithIdToken = jest.fn(async () => ({
      data: { user: { id: 'user-2', user_metadata: {} } },
      error: null,
    }));
    (getSupabase as jest.Mock).mockReturnValue(supabase);
    (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue({
      identityToken: 'id-token',
      user: 'apple-user',
      fullName: { givenName: 'Ada', familyName: 'Lovelace' },
      email: 'ada@example.com',
    });

    await act(async () => {
      render(
        <AuthProvider>
          <AuthProbe />
        </AuthProvider>,
      );
    });
    await fireEvent.press(screen.getByTestId('do-signin'));
    await waitFor(() => {
      expect(supabase.auth.signInWithIdToken).toHaveBeenCalled();
    });
  });

  test('signInWithApple handles missing token and cancel', async () => {
    const supabase = makeSupabase();
    (getSupabase as jest.Mock).mockReturnValue(supabase);

    await act(async () => {
      render(
        <AuthProvider>
          <AuthProbe />
        </AuthProvider>,
      );
    });

    (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValue({
      identityToken: null,
    });
    await fireEvent.press(screen.getByTestId('do-signin'));
    await waitFor(() => {
      expect(String(screen.getByTestId('alert').props.children)).toMatch(
        /identity token/i,
      );
    });

    (AppleAuthentication.signInAsync as jest.Mock).mockRejectedValue({
      code: 'ERR_REQUEST_CANCELED',
    });
    await fireEvent.press(screen.getByTestId('do-signin'));
    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('guest');
    });
  });

  test('signOut clears session to guest', async () => {
    const supabase = makeSupabase({
      getSession: jest.fn(async () => ({
        data: {
          session: { user: { id: 'user-1', user_metadata: {} }, access_token: 't' },
        },
        error: null,
      })),
    });
    (getSupabase as jest.Mock).mockReturnValue(supabase);

    await act(async () => {
      render(
        <AuthProvider>
          <AuthProbe />
        </AuthProvider>,
      );
    });
    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('signed-in');
    });
    await fireEvent.press(screen.getByTestId('do-signout'));
    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('guest');
    });
    expect(supabase.auth.signOut).toHaveBeenCalled();
  });

  test('deleteAccount completes on success', async () => {
    const supabase = makeSupabase({
      getSession: jest.fn(async () => ({
        data: {
          session: { user: { id: 'user-1', user_metadata: {} }, access_token: 't' },
        },
        error: null,
      })),
    });
    (getSupabase as jest.Mock).mockReturnValue(supabase);

    await act(async () => {
      render(
        <AuthProvider>
          <AuthProbe />
        </AuthProvider>,
      );
    });
    await waitFor(() => {
      expect(screen.getByTestId('user').props.children).toBe('user-1');
    });

    mockPerformDeletion.mockResolvedValue({ ok: true });
    await fireEvent.press(screen.getByTestId('do-delete'));
    await waitFor(() => {
      expect(screen.getByTestId('status').props.children).toBe('guest');
    });
  });

  test('deleteAccount pauses on revoke failure', async () => {
    const supabase = makeSupabase({
      getSession: jest.fn(async () => ({
        data: {
          session: { user: { id: 'user-1', user_metadata: {} }, access_token: 't' },
        },
        error: null,
      })),
    });
    (getSupabase as jest.Mock).mockReturnValue(supabase);

    await act(async () => {
      render(
        <AuthProvider>
          <AuthProbe />
        </AuthProvider>,
      );
    });
    await waitFor(() => {
      expect(screen.getByTestId('user').props.children).toBe('user-1');
    });

    mockPerformDeletion.mockResolvedValue({
      ok: false,
      code: 'apple_revoke_failed',
      message: 'paused',
    });
    await fireEvent.press(screen.getByTestId('do-delete'));
    await waitFor(() => {
      expect(screen.getByTestId('retry').props.children).toBe('true');
    });
  });

  test('useAuth outside provider returns guest soft-fail', async () => {
    function ReadAuth() {
      const auth = useAuth();
      return (
        <>
          <Text testID="out-status">{auth.status}</Text>
          <Text testID="out-configured">{String(auth.authConfigured)}</Text>
        </>
      );
    }
    await act(async () => {
      render(<ReadAuth />);
    });
    expect(screen.getByTestId('out-status').props.children).toBe('guest');
    expect(screen.getByTestId('out-configured').props.children).toBe('false');
  });
});
