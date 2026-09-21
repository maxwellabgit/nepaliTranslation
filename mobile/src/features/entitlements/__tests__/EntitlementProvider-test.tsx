import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import {
  EntitlementProvider,
  useEntitlement,
  useEntitlementOptional,
} from '../EntitlementProvider';
import { getSupabase } from '../../../services/supabase';
import { saveCachedEntitlement } from '../entitlementCache';
import { useAuth } from '../../auth/AuthProvider';

jest.mock('../../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;

function Probe() {
  const ent = useEntitlement();
  return (
    <>
      <Text testID="ready">{String(ent.ready)}</Text>
      <Text testID="credits">{String(ent.lifetimeCredits)}</Text>
      <Text testID="ad-free">{String(ent.hasActiveEarnedAdFree())}</Text>
      <Text testID="trusted">{String(ent.trustedNow())}</Text>
    </>
  );
}

describe('EntitlementProvider', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    mockUseAuth.mockReturnValue({
      status: 'guest',
      userId: null,
    });
  });

  test('guest clears cache and reports not ad-free', async () => {
    await saveCachedEntitlement({
      earnedAdFreeUntilMs: Date.now() + 60_000,
      lifetimeCredits: 5,
      version: 1,
      syncedAtMs: Date.now(),
    });

    await act(async () => {
      render(
        <EntitlementProvider>
          <Probe />
        </EntitlementProvider>,
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('ready').props.children).toBe('true');
    });
    expect(screen.getByTestId('credits').props.children).toBe('0');
    expect(screen.getByTestId('ad-free').props.children).toBe('false');
    expect(await AsyncStorage.getItem('nepx.entitlement.v1')).toBeNull();
  });

  test('signed-in refresh loads server entitlement and trusted clock', async () => {
    const serverNow = '2026-09-20T12:00:00.000Z';
    const until = '2026-09-20T13:00:00.000Z';
    mockUseAuth.mockReturnValue({
      status: 'signed-in',
      userId: 'user-1',
    });
    (getSupabase as jest.Mock).mockReturnValue({
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn(async () => ({
              data: {
                earned_ad_free_until: until,
                lifetime_credits: 9,
                version: 3,
              },
              error: null,
            })),
          })),
        })),
      })),
      rpc: jest.fn(async () => ({ data: serverNow, error: null })),
    });

    await act(async () => {
      render(
        <EntitlementProvider>
          <Probe />
        </EntitlementProvider>,
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('credits').props.children).toBe('9');
    });
    expect(screen.getByTestId('ad-free').props.children).toBe('true');
    expect(Number(screen.getByTestId('trusted').props.children)).toBe(
      Date.parse(serverNow),
    );
  });

  test('falls back to local cache when server time fails', async () => {
    const syncedAt = Date.now();
    await saveCachedEntitlement({
      earnedAdFreeUntilMs: syncedAt + 3600_000,
      lifetimeCredits: 2,
      version: 1,
      syncedAtMs: syncedAt,
    });
    mockUseAuth.mockReturnValue({
      status: 'signed-in',
      userId: 'user-1',
    });
    (getSupabase as jest.Mock).mockReturnValue({
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn(async () => ({
              data: {
                earned_ad_free_until: null,
                lifetime_credits: 2,
                version: 1,
              },
              error: null,
            })),
          })),
        })),
      })),
      rpc: jest.fn(async () => ({ data: null, error: { message: 'fail' } })),
    });

    await act(async () => {
      render(
        <EntitlementProvider>
          <Probe />
        </EntitlementProvider>,
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('credits').props.children).toBe('2');
    });
    expect(screen.getByTestId('trusted').props.children).toBe('null');
    expect(screen.getByTestId('ad-free').props.children).toBe('false');
  });

  test('refresh without supabase uses cached entitlement only', async () => {
    await saveCachedEntitlement({
      earnedAdFreeUntilMs: null,
      lifetimeCredits: 4,
      version: 1,
      syncedAtMs: Date.now(),
    });
    mockUseAuth.mockReturnValue({
      status: 'signed-in',
      userId: 'user-1',
    });
    (getSupabase as jest.Mock).mockReturnValue(null);

    await act(async () => {
      render(
        <EntitlementProvider>
          <Probe />
        </EntitlementProvider>,
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('credits').props.children).toBe('4');
    });
  });

  test('useEntitlementOptional returns null outside provider', async () => {
    function OptionalProbe() {
      const ent = useEntitlementOptional();
      return <Text testID="optional">{ent === null ? 'null' : 'set'}</Text>;
    }
    await act(async () => {
      render(<OptionalProbe />);
    });
    expect(screen.getByTestId('optional').props.children).toBe('null');
  });
});
