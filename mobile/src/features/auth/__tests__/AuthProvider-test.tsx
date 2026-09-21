import { act, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { AuthProvider, useAuth } from '../AuthProvider';
import { getSupabase } from '../../../services/supabase';
import { loadHistory, addHistory, clearHistory } from '../../../storage/phrasebook';
import AsyncStorage from '@react-native-async-storage/async-storage';

function Probe() {
  const auth = useAuth();
  return (
    <Text testID="auth-status">{auth.status}</Text>
  );
}

describe('AuthProvider Apple revoke listener', () => {
  const remove = jest.fn();
  let revokeListener: (() => void) | null = null;

  beforeEach(async () => {
    await AsyncStorage.clear();
    await clearHistory();
    remove.mockClear();
    revokeListener = null;
    (AppleAuthentication.addRevokeListener as jest.Mock).mockImplementation(
      (listener: () => void) => {
        revokeListener = listener;
        return { remove };
      },
    );
    (getSupabase as jest.Mock).mockReturnValue({
      auth: {
        getSession: jest.fn(async () => ({
          data: {
            session: {
              user: { id: 'user-1', user_metadata: {} },
              access_token: 'tok',
            },
          },
          error: null,
        })),
        onAuthStateChange: jest.fn(() => ({
          data: { subscription: { unsubscribe: jest.fn() } },
        })),
        signOut: jest.fn(async () => undefined),
        signInWithIdToken: jest.fn(),
        updateUser: jest.fn(),
      },
    });
  });

  test('subscribes once and removes listener on teardown', async () => {
    const view = await act(async () =>
      render(
        <AuthProvider>
          <Probe />
        </AuthProvider>,
      ),
    );
    expect(AppleAuthentication.addRevokeListener).toHaveBeenCalledTimes(1);
    await act(async () => {
      await view.unmount();
    });
    expect(remove).toHaveBeenCalledTimes(1);
  });

  test('credential revoke signs out to guest without clearing history', async () => {
    await addHistory({
      source: 'hello',
      translation: 'नमस्ते',
      sourceLang: 'en',
      targetLang: 'ne',
    });
    await act(async () => {
      render(
        <AuthProvider>
          <Probe />
        </AuthProvider>,
      );
    });
    await waitFor(() => {
      expect(revokeListener).toBeTruthy();
    });
    await act(async () => {
      revokeListener?.();
    });
    await waitFor(async () => {
      expect((await loadHistory()).length).toBe(1);
    });
  });
});
