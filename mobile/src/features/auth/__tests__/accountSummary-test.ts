import { fetchAccountSummary } from '../accountSummary';
import { getSupabase } from '../../../services/supabase';
import { readPublicEnv } from '../../../config/env';

jest.mock('../../../config/env', () => ({
  readPublicEnv: jest.fn(),
}));

const mockReadPublicEnv = readPublicEnv as jest.Mock;

describe('fetchAccountSummary', () => {
  beforeEach(() => {
    mockReadPublicEnv.mockReturnValue({
      supabaseUrl: 'https://example.supabase.co',
      supabaseAnonKey: 'anon-key',
      authConfigured: true,
    });
    globalThis.fetch = jest.fn() as typeof fetch;
  });

  test('returns unavailable when Supabase is missing', async () => {
    (getSupabase as jest.Mock).mockReturnValue(null);
    expect(await fetchAccountSummary()).toEqual({
      ok: false,
      code: 'unavailable',
    });
  });

  test('returns unauthorized without session', async () => {
    (getSupabase as jest.Mock).mockReturnValue({
      auth: {
        getSession: jest.fn(async () => ({ data: { session: null } })),
      },
    });
    expect(await fetchAccountSummary()).toEqual({
      ok: false,
      code: 'unauthorized',
    });
  });

  test('maps account-summary JSON into client summary', async () => {
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
        consent_version: '2026-09-19.draft',
        age_confirmed_at: '2026-09-20T00:00:00Z',
        receipt_count: 3,
        lifetime_credits: 12,
        earned_ad_free_until: '2026-10-01T00:00:00Z',
      }),
    });

    const result = await fetchAccountSummary();
    expect(result).toEqual({
      ok: true,
      summary: {
        consentVersion: '2026-09-19.draft',
        ageConfirmed: true,
        receiptCount: 3,
        lifetimeCredits: 12,
        earnedAdFreeUntil: '2026-10-01T00:00:00Z',
        deletionRequestedAt: null,
        deletionDueAt: null,
        nyRewardCloseAt: null,
      },
    });
  });

  test('defaults missing numeric fields to zero', async () => {
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
      json: async () => ({}),
    });

    const result = await fetchAccountSummary();
    expect(result).toEqual({
      ok: true,
      summary: {
        consentVersion: null,
        ageConfirmed: false,
        receiptCount: 0,
        lifetimeCredits: 0,
        earnedAdFreeUntil: null,
        deletionRequestedAt: null,
        deletionDueAt: null,
        nyRewardCloseAt: null,
      },
    });
  });

  test('maps 401 and network errors', async () => {
    (getSupabase as jest.Mock).mockReturnValue({
      auth: {
        getSession: jest.fn(async () => ({
          data: { session: { access_token: 'tok' } },
        })),
      },
    });
    (globalThis.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockRejectedValueOnce(new Error('offline'));

    expect(await fetchAccountSummary()).toEqual({
      ok: false,
      code: 'unauthorized',
    });
    expect(await fetchAccountSummary()).toEqual({
      ok: false,
      code: 'unavailable',
    });
  });
});
