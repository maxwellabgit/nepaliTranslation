import { getSupabase } from '../../../services/supabase';
import { readPublicEnv } from '../../../config/env';
import { recordStartupConsent } from '../recordStartupConsent';

jest.mock('../../../config/env', () => ({
  readPublicEnv: jest.fn(),
}));

const mockReadPublicEnv = readPublicEnv as jest.Mock;

describe('recordStartupConsent', () => {
  beforeEach(() => {
    mockReadPublicEnv.mockReturnValue({
      supabaseUrl: 'https://example.supabase.co',
      supabaseAnonKey: 'anon',
      authConfigured: true,
    });
    globalThis.fetch = jest.fn() as typeof fetch;
    (getSupabase as jest.Mock).mockReturnValue({
      auth: {
        getSession: jest.fn(async () => ({
          data: {
            session: {
              access_token: 'tok',
              user: { id: 'user-1' },
            },
          },
        })),
      },
    });
  });

  test('unavailable when auth is not configured', async () => {
    mockReadPublicEnv.mockReturnValue({
      supabaseUrl: '',
      supabaseAnonKey: '',
      authConfigured: false,
    });
    (getSupabase as jest.Mock).mockReturnValue(null);
    expect(
      await recordStartupConsent({
        terms: true,
        privacy: true,
        age18Plus: true,
      }),
    ).toEqual({ ok: false, code: 'unavailable' });
  });

  test('unauthorized when no session', async () => {
    (getSupabase as jest.Mock).mockReturnValue({
      auth: {
        getSession: jest.fn(async () => ({ data: { session: null } })),
      },
    });
    expect(
      await recordStartupConsent({
        terms: true,
        privacy: true,
        age18Plus: true,
      }),
    ).toEqual({ ok: false, code: 'unauthorized' });
  });

  test('incomplete when Terms or Privacy is false', async () => {
    expect(
      await recordStartupConsent({
        terms: true,
        privacy: false,
        age18Plus: true,
      }),
    ).toEqual({ ok: false, code: 'incomplete' });
    expect(
      await recordStartupConsent({
        terms: false,
        privacy: true,
        age18Plus: true,
      }),
    ).toEqual({ ok: false, code: 'incomplete' });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  test('posts age18Plus false for startup consent', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
    });
    const result = await recordStartupConsent({
      terms: true,
      privacy: true,
      age18Plus: false,
    });
    expect(result).toEqual({ ok: true });
    const body = JSON.parse((globalThis.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.p_age_confirmed).toBe(false);
    expect(body.p_version).toBe('2026-09-23.startup');
  });

  test('POST when all three boxes checked', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
    });
    const result = await recordStartupConsent({
      terms: true,
      privacy: true,
      age18Plus: true,
    });
    expect(result).toEqual({ ok: true });
    const [url, init] = (globalThis.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('/rest/v1/rpc/service_record_startup_consent');
    const body = JSON.parse(init.body);
    expect(body.p_user_id).toBe('user-1');
    expect(body.p_terms_accepted).toBe(true);
    expect(body.p_privacy_accepted).toBe(true);
    expect(body.p_age_confirmed).toBe(true);
  });

  test('maps 409 to outdated version code', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 409,
    });
    const result = await recordStartupConsent({
      terms: true,
      privacy: true,
      age18Plus: true,
    });
    expect(result).toEqual({ ok: false, code: 'outdated' });
  });
});
