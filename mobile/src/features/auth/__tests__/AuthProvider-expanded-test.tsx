import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text, Pressable } from 'react-native';
import { saveLocalConsent, loadLocalConsent } from '../../../storage/contributionConsent';
import { SESSION_INACTIVITY_MS, touchSessionActivity } from '../sessionExpiry';
import { savePendingDeletionIntent, savePendingDeletionDue } from '../../../storage/pendingDeletion';
import { AuthProvider, useAuth } from '../AuthProvider';
import { getSupabase } from '../../../services/supabase';
import { fetchAccountSummary } from '../accountSummary';
import { performAccountDeletion } from '../deleteAccount';
jest.mock('../accountSummary', () => ({ fetchAccountSummary: jest.fn() }));
jest.mock('../deleteAccount', () => ({ performAccountDeletion: jest.fn() }));
function Probe() {
  const value = useAuth();
  return <><Text testID="status">{value.status}</Text><Text testID="owner">{value.userId ?? 'none'}</Text>
    <Text testID="consent">{value.consentVersion ?? 'none'}</Text><Text testID="due">{value.deletionDueAt ?? 'none'}</Text><Text testID="retry">{String(value.deletionRetryPending)}</Text>
    <Pressable testID="retry-identity" onPress={() => { void value.retryIdentity(); }} />
    <Pressable testID="delete-data" onPress={() => { void value.deleteData(); }} /></>;
}
function client(id: string | null = 'private-uuid') {
  const session = id ? { access_token: 'jwt', user: { id } } : null;
  return { auth: { getSession: jest.fn(async () => ({ data: { session }, error: null })),
    signInAnonymously: jest.fn(async () => ({ data: { session: { access_token: 'jwt', user: { id: 'new-guest' } } }, error: null })),
    onAuthStateChange: jest.fn((_callback: (event: string, session: unknown) => void) => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    signOut: jest.fn(), refreshSession: jest.fn() } };
}
beforeEach(async () => {
  await AsyncStorage.clear();
  (fetchAccountSummary as jest.Mock).mockResolvedValue({ ok: false });
  (performAccountDeletion as jest.Mock).mockReset();
});
test('creates an invisible authenticated guest with no account controls', async () => {
  const value = client(null);
  (getSupabase as jest.Mock).mockReturnValue(value);
  await act(async () => { render(<AuthProvider><Probe /></AuthProvider>); });
  await waitFor(() => expect(screen.getByTestId('owner').props.children).toBe('new-guest'));
  expect(value.auth.signInAnonymously).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('status').props.children).toBe('signed-in');
});
test('offline identity creation fails soft and explicit retry succeeds', async () => {
  const value = client(null);
  value.auth.signInAnonymously.mockRejectedValueOnce(new Error('offline'));
  (getSupabase as jest.Mock).mockReturnValue(value);
  await act(async () => { render(<AuthProvider><Probe /></AuthProvider>); });
  expect(screen.getByTestId('status').props.children).toBe('guest');
  await act(async () => { fireEvent.press(screen.getByTestId('retry-identity')); });
  expect(screen.getByTestId('owner').props.children).toBe('new-guest');
});
test('accepted deletion retains private subject and JWT instead of resetting identity or credits', async () => {
  const value = client();
  (getSupabase as jest.Mock).mockReturnValue(value);
  (performAccountDeletion as jest.Mock).mockResolvedValue({ ok: true, scheduled: true, deletionDueAt: '2026-11-01T00:00:00Z' });
  await act(async () => { render(<AuthProvider><Probe /></AuthProvider>); });
  await act(async () => { fireEvent.press(screen.getByTestId('delete-data')); });
  expect(screen.getByTestId('owner').props.children).toBe('private-uuid');
  expect(screen.getByTestId('due').props.children).toBe('2026-11-01T00:00:00Z');
  expect(value.auth.signOut).not.toHaveBeenCalled();
  expect(value.auth.signInAnonymously).not.toHaveBeenCalled();
});
test('failed deletion preserves its private subject for retry', async () => {
  (getSupabase as jest.Mock).mockReturnValue(client());
  (performAccountDeletion as jest.Mock).mockResolvedValue({ ok: false, message: 'offline' });
  await act(async () => { render(<AuthProvider><Probe /></AuthProvider>); });
  await act(async () => { fireEvent.press(screen.getByTestId('delete-data')); });
  expect(screen.getByTestId('owner').props.children).toBe('private-uuid');
  expect(screen.getByTestId('retry').props.children).toBe('true');
});

test('offline restart hydrates only its owner pending deletion and keeps re-consent blocked', async () => {
  await AsyncStorage.setItem('neptranslate.private_identity.v1', 'private-uuid');
  await savePendingDeletionIntent('private-uuid');
  await savePendingDeletionDue('private-uuid', '2026-11-01T00:00:00Z');
  const value = client();
  value.auth.getSession.mockRejectedValue(new Error('offline'));
  (getSupabase as jest.Mock).mockReturnValue(value);
  await act(async () => { render(<AuthProvider><Probe /></AuthProvider>); });
  expect(screen.getByTestId('owner').props.children).toBe('private-uuid');
  expect(screen.getByTestId('status').props.children).toBe('guest');
  expect(screen.getByTestId('due').props.children).toBe('2026-11-01T00:00:00Z');
  expect(value.auth.signInAnonymously).not.toHaveBeenCalled();
});
test('an unsent pending deletion retries once on startup and cannot inherit a stale permission summary', async () => {
  await AsyncStorage.setItem('neptranslate.private_identity.v1', 'private-uuid');
  await savePendingDeletionIntent('private-uuid');
  (getSupabase as jest.Mock).mockReturnValue(client());
  (performAccountDeletion as jest.Mock).mockResolvedValue({ ok: false, message: 'offline' });
  (fetchAccountSummary as jest.Mock).mockResolvedValue({ ok: true, summary: { consentVersion: 'old-opt-in', ageConfirmed: true, deletionDueAt: null, deletionCompletedAt: null } });
  await act(async () => { render(<AuthProvider><Probe /></AuthProvider>); });
  await waitFor(() => expect(screen.getByTestId('retry').props.children).toBe('true'));
  expect(performAccountDeletion).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('owner').props.children).toBe('private-uuid');
});

test('recovered anonymous SIGNED_IN connects on the first retry without invalidating the identity result', async () => {
  const value = client('old-owner');
  (getSupabase as jest.Mock).mockReturnValue(value);
  await act(async () => { render(<AuthProvider><Probe /></AuthProvider>); });
  expect(screen.getByTestId('owner').props.children).toBe('old-owner');
  value.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
  value.auth.refreshSession.mockResolvedValue({ data: { session: null }, error: { name: 'AuthSessionMissingError' } });
  const listener = value.auth.onAuthStateChange.mock.calls[0][0] as unknown as (event: string, session: unknown) => void;
  value.auth.signInAnonymously.mockImplementation(async () => {
    const session = { access_token: 'new-jwt', user: { id: 'new-guest' } };
    listener('SIGNED_IN', session);
    return { data: { session }, error: null };
  });
  await act(async () => { fireEvent.press(screen.getByTestId('retry-identity')); });
  expect(screen.getByTestId('owner').props.children).toBe('new-guest');
  expect(screen.getByTestId('status').props.children).toBe('signed-in');
  expect(value.auth.signInAnonymously).toHaveBeenCalledTimes(1);
});

test('cold offline startup preserves the known owner for local privacy controls', async () => {
  await AsyncStorage.setItem('neptranslate.private_identity.v1', 'private-uuid');
  const value = client();
  value.auth.getSession.mockRejectedValue(new Error('offline'));
  (getSupabase as jest.Mock).mockReturnValue(value);
  await act(async () => { render(<AuthProvider><Probe /></AuthProvider>); });
  expect(screen.getByTestId('owner').props.children).toBe('private-uuid');
  expect(screen.getByTestId('status').props.children).toBe('guest');
});
test('thirty-day inactivity keeps its UUID but requires fresh owner consent before contribution', async () => {
  await AsyncStorage.setItem('neptranslate.private_identity.v1', 'private-uuid');
  const consent = await saveLocalConsent(true, 'private-uuid');
  await touchSessionActivity('private-uuid', Date.now() - SESSION_INACTIVITY_MS - 1);
  (getSupabase as jest.Mock).mockReturnValue(client());
  (fetchAccountSummary as jest.Mock).mockResolvedValue({ ok: true, summary: { consentVersion: consent?.consent_version, ageConfirmed: true, deletionDueAt: null, deletionCompletedAt: null } });
  await act(async () => { render(<AuthProvider><Probe /></AuthProvider>); });
  expect(screen.getByTestId('owner').props.children).toBe('private-uuid');
  expect(screen.getByTestId('consent').props.children).toBe('none');
  expect(await loadLocalConsent('private-uuid')).toBeNull();
});
