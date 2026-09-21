import { requestRewardedSession } from '../rewardedSession';
import { getSupabase } from '../../../services/supabase';
import { readPublicEnv } from '../../../config/env';

jest.mock('../../../config/env', () => ({
  readPublicEnv: jest.fn(),
}));

const mockReadPublicEnv = readPublicEnv as jest.Mock;

describe('requestRewardedSession', () => {
  beforeEach(() => {
    mockReadPublicEnv.mockReturnValue({
      supabaseUrl: 'https://example.supabase.co',
      supabaseAnonKey: 'anon-key',
      authConfigured: true,
    });
    globalThis.fetch = jest.fn() as typeof fetch;
  });

  test('returns unavailable when auth is not configured', async () => {
    mockReadPublicEnv.mockReturnValue({
      supabaseUrl: '',
      supabaseAnonKey: '',
      authConfigured: false,
    });
    (getSupabase as jest.Mock).mockReturnValue(null);

    expect(await requestRewardedSession()).toEqual({
      ok: false,
      reason: 'unavailable',
    });
  });

  test('returns unauthorized without session token', async () => {
    (getSupabase as jest.Mock).mockReturnValue({
      auth: {
        getSession: jest.fn(async () => ({ data: { session: null } })),
      },
    });

    expect(await requestRewardedSession()).toEqual({
      ok: false,
      reason: 'unauthorized',
    });
  });

  test('returns session token and expiry on success', async () => {
    (getSupabase as jest.Mock).mockReturnValue({
      auth: {
        getSession: jest.fn(async () => ({
          data: { session: { access_token: 'tok' } },
        })),
      },
    });
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        session_token: 'sess-abc',
        expires_at: '2026-09-20T12:00:00.000Z',
      }),
    });

    const result = await requestRewardedSession();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.session.sessionToken).toBe('sess-abc');
      expect(result.session.expiresAtMs).toBe(
        Date.parse('2026-09-20T12:00:00.000Z'),
      );
    }
  });

  test('maps 401, invalid payload, and network errors', async () => {
    (getSupabase as jest.Mock).mockReturnValue({
      auth: {
        getSession: jest.fn(async () => ({
          data: { session: { access_token: 'tok' } },
        })),
      },
    });
    (globalThis.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ session_token: 'x' }),
      })
      .mockRejectedValueOnce(new Error('offline'));

    expect(await requestRewardedSession()).toEqual({
      ok: false,
      reason: 'unauthorized',
    });
    expect(await requestRewardedSession()).toEqual({
      ok: false,
      reason: 'unavailable',
    });
    expect(await requestRewardedSession()).toEqual({
      ok: false,
      reason: 'invalid_payload',
    });
    expect(await requestRewardedSession()).toEqual({
      ok: false,
      reason: 'unavailable',
    });
  });
});
