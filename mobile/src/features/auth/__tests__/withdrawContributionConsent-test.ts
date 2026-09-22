/// <reference types="node" />
import { withdrawContributionConsent } from '../withdrawContributionConsent';

jest.mock('../../../config/env', () => ({
  readPublicEnv: jest.fn(() => ({
    supabaseUrl: 'https://example.supabase.co',
    supabaseAnonKey: 'anon-key',
    authConfigured: true,
  })),
}));

jest.mock('../../../services/supabase', () => ({
  getSupabase: jest.fn(),
}));

const { readPublicEnv } = require('../../../config/env') as {
  readPublicEnv: jest.Mock;
};
const { getSupabase } = require('../../../services/supabase') as {
  getSupabase: jest.Mock;
};

describe('withdrawContributionConsent', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    readPublicEnv.mockReturnValue({
      supabaseUrl: 'https://example.supabase.co',
      supabaseAnonKey: 'anon-key',
      authConfigured: true,
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('returns unavailable when auth is not configured', async () => {
    readPublicEnv.mockReturnValueOnce({
      supabaseUrl: '',
      supabaseAnonKey: '',
      authConfigured: false,
    });
    getSupabase.mockReturnValue(null);
    const res = await withdrawContributionConsent();
    expect(res).toEqual({ ok: false, code: 'unavailable' });
  });

  it('returns unauthorized when no session', async () => {
    getSupabase.mockReturnValue({
      auth: { getSession: async () => ({ data: { session: null } }) },
    });
    const res = await withdrawContributionConsent();
    expect(res).toEqual({ ok: false, code: 'unauthorized' });
  });

  it('returns forbidden on HTTP 403', async () => {
    getSupabase.mockReturnValue({
      auth: {
        getSession: async () => ({
          data: {
            session: {
              access_token: 'tok',
              user: { id: '11111111-1111-4111-8111-111111111111' },
            },
          },
        }),
      },
    });
    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({ error: { code: 'forbidden' } }), {
        status: 403,
      }),
    ) as unknown as typeof fetch;
    const res = await withdrawContributionConsent();
    expect(res).toEqual({ ok: false, code: 'forbidden' });
  });

  it('returns deletion_due_at on success', async () => {
    getSupabase.mockReturnValue({
      auth: {
        getSession: async () => ({
          data: {
            session: {
              access_token: 'tok',
              user: { id: '11111111-1111-4111-8111-111111111111' },
            },
          },
        }),
      },
    });
    const due = '2027-01-01T00:00:00.000Z';
    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({ deletion_due_at: due }), { status: 200 }),
    ) as unknown as typeof fetch;
    const res = await withdrawContributionConsent();
    expect(res).toEqual({ ok: true, deletionDueAt: due });
  });
});
