import { recordContributionConsent } from '../recordConsent';
import { getSupabase } from '../../../services/supabase';
import { CONTRIBUTION_CONSENT_VERSION } from '../consent';
import { readPublicEnv } from '../../../config/env';

jest.mock('../../../config/env', () => ({
  readPublicEnv: jest.fn(),
}));

const mockReadPublicEnv = readPublicEnv as jest.Mock;

describe('recordContributionConsent', () => {
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

    expect(await recordContributionConsent()).toEqual({
      ok: false,
      code: 'unavailable',
    });
  });

  test('returns unauthorized without a session token', async () => {
    (getSupabase as jest.Mock).mockReturnValue({
      auth: {
        getSession: jest.fn(async () => ({ data: { session: null } })),
      },
    });

    expect(await recordContributionConsent()).toEqual({
      ok: false,
      code: 'unauthorized',
    });
  });

  test('posts consent version and age confirmation on success', async () => {
    (getSupabase as jest.Mock).mockReturnValue({
      auth: {
        getSession: jest.fn(async () => ({
          data: { session: { access_token: 'tok-123' } },
        })),
      },
    });
    (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200 });

    const result = await recordContributionConsent();
    expect(result).toEqual({ ok: true });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://example.supabase.co/functions/v1/record-consent',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          authorization: 'Bearer tok-123',
          apikey: 'anon-key',
        }),
        body: JSON.stringify({
          consent_version: CONTRIBUTION_CONSENT_VERSION,
          age_confirmed: true,
        }),
      }),
    );
  });

  test('maps 400 to invalid_payload and 401 to unauthorized', async () => {
    (getSupabase as jest.Mock).mockReturnValue({
      auth: {
        getSession: jest.fn(async () => ({
          data: { session: { access_token: 'tok' } },
        })),
      },
    });
    (globalThis.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: false, status: 400 })
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValueOnce({ ok: false, status: 503 });

    expect(await recordContributionConsent()).toEqual({
      ok: false,
      code: 'invalid_payload',
    });
    expect(await recordContributionConsent()).toEqual({
      ok: false,
      code: 'unauthorized',
    });
    expect(await recordContributionConsent()).toEqual({
      ok: false,
      code: 'unavailable',
    });
  });
});
