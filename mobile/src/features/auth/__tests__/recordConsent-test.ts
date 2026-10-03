import { recordContributionConsent } from '../recordConsent';
import { getSupabase } from '../../../services/supabase';
import { CONTRIBUTION_CONSENT_VERSION } from '../consent';
import { saveLocalConsent } from '../../../storage/contributionConsent';
import { readPublicEnv } from '../../../config/env';

jest.mock('../../../config/env', () => ({
  readPublicEnv: jest.fn(),
}));

jest.mock('../../../storage/contributionConsent', () => ({ saveLocalConsent: jest.fn() }));
const owner = '11111111-1111-4111-8111-111111111111';
const mockReadPublicEnv = readPublicEnv as jest.Mock;

describe('recordContributionConsent', () => {
  beforeEach(() => {
    (saveLocalConsent as jest.Mock).mockImplementation(async (_age, _owner, guard) => !guard || guard() ? { age_confirmed: true } : null);
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
          data: { session: { access_token: 'tok-123', user: { id: owner } } },
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
          data: { session: { access_token: 'tok', user: { id: owner } } },
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
  test.each(['deletion', 'owner change'])('rejects a deferred success after %s invalidates consent', async () => {
    (getSupabase as jest.Mock).mockReturnValue({ auth: { getSession: jest.fn(async () => ({
      data: { session: { access_token: 'tok', user: { id: owner } } },
    })) } });
    let resolve!: (value: unknown) => void;
    (globalThis.fetch as jest.Mock).mockReturnValue(new Promise(done => { resolve = done; }));
    let valid = true;
    const pending = recordContributionConsent(owner, () => valid);
    await Promise.resolve();
    valid = false;
    resolve({ ok: true, status: 200 });
    expect(await pending).toEqual({ ok: false, code: 'unauthorized' });
  });
  test('rejects a replaced owner before sending any consent request', async () => {
    (getSupabase as jest.Mock).mockReturnValue({ auth: { getSession: jest.fn(async () => ({
      data: { session: { access_token: 'tok', user: { id: 'different-owner' } } },
    })) } });
    expect(await recordContributionConsent(owner)).toEqual({ ok: false, code: 'unauthorized' });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
  test('network rejection is fail-soft and never saves consent', async () => {
    (saveLocalConsent as jest.Mock).mockClear();
    (getSupabase as jest.Mock).mockReturnValue({ auth: { getSession: jest.fn(async () => ({
      data: { session: { access_token: 'tok', user: { id: owner } } },
    })) } });
    (globalThis.fetch as jest.Mock).mockRejectedValue(new Error('offline'));
    expect(await recordContributionConsent(owner)).toEqual({ ok: false, code: 'unavailable' });
    expect(saveLocalConsent).not.toHaveBeenCalled();
  });

  test('live SDK owner replacement rejects success even if UI guard has not updated', async () => {
    const getSession = jest.fn()
      .mockResolvedValueOnce({ data: { session: { access_token: 'tok', user: { id: owner } } } })
      .mockResolvedValueOnce({ data: { session: { access_token: 'new', user: { id: 'different-owner' } } } });
    (getSupabase as jest.Mock).mockReturnValue({ auth: { getSession } });
    (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200 });
    (saveLocalConsent as jest.Mock).mockClear();
    expect(await recordContributionConsent(owner, () => true)).toEqual({ ok: false, code: 'unauthorized' });
    expect(saveLocalConsent).not.toHaveBeenCalled();
  });

});
