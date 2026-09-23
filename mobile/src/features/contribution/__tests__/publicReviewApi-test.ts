import {
  creditLabelForTier,
  fetchCurrentReviewWindow,
  firstUnsubmittedIndex,
  submitReview,
} from '../publicReviewApi';
import { getSupabase } from '../../../services/supabase';
import { readPublicEnv } from '../../../config/env';

jest.mock('../../../config/env', () => ({
  readPublicEnv: jest.fn(),
}));

const mockReadPublicEnv = readPublicEnv as jest.Mock;

describe('publicReviewApi (G1 global 10/day pool)', () => {
  beforeEach(() => {
    mockReadPublicEnv.mockReturnValue({
      supabaseUrl: 'https://example.supabase.co',
      supabaseAnonKey: 'anon-key',
      authConfigured: true,
    });
    globalThis.fetch = jest.fn() as typeof fetch;
    (getSupabase as jest.Mock).mockReturnValue({
      auth: {
        getSession: jest.fn(async () => ({
          data: { session: { access_token: 'tok' } },
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
    const result = await fetchCurrentReviewWindow();
    expect(result).toEqual({ ok: false, reason: 'unavailable' });
  });

  test('sign_in when no session token', async () => {
    (getSupabase as jest.Mock).mockReturnValue({
      auth: {
        getSession: jest.fn(async () => ({ data: { session: null } })),
      },
    });
    const result = await fetchCurrentReviewWindow();
    expect(result).toEqual({ ok: false, reason: 'sign_in' });
  });

  test('parses shared 10-item window response', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        window: {
          window_id: 'w-1',
          ny_close_at: '2026-09-23T21:00:00Z',
          size: 10,
        },
        items: [
          {
            slot: 1,
            source_item_id: 'src-1',
            direction: 'en-ne',
            register: 'formal',
            script: 'deva',
            source_text: 'Hello',
            proposed_target: 'नमस्ते',
            length_tier: 2,
            scheduled_credits: 2,
          },
        ],
      }),
    });
    const result = await fetchCurrentReviewWindow();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.window?.size).toBe(10);
    expect(result.items[0].scheduled_credits).toBe(2);
    expect(result.items[0].length_tier).toBe(2);
    expect(result.mine).toEqual([]);
  });

  test('empty response is null window', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ window: null, items: [] }),
    });
    const result = await fetchCurrentReviewWindow();
    expect(result).toEqual({ ok: true, window: null, items: [], mine: [] });
  });

  test('keeps the caller submissions and skips to the next item', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        window: { window_id: 'w-1', ny_close_at: '2026-09-23T21:00:00Z', size: 2 },
        items: [
          { slot: 1, source_item_id: 'src-1' },
          { slot: 2, source_item_id: 'src-2' },
        ],
        mine: [
          {
            source_item_id: 'src-1',
            action: 'edit',
            corrected_text: 'नमस्ते',
            reward_granted: false,
          },
        ],
      }),
    });
    const result = await fetchCurrentReviewWindow();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.mine[0].corrected_text).toBe('नमस्ते');
    expect(firstUnsubmittedIndex(result.items, result.mine)).toBe(1);
  });

  test('submitReview requires text for edit action locally', async () => {
    const result = await submitReview({
      windowId: 'w-1',
      sourceItemId: 'src-1',
      action: 'edit',
      correctedText: '   ',
    });
    expect(result).toEqual({ ok: false, reason: 'invalid' });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  test('submitReview maps window_closed', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: { code: 'window_closed' } }),
    });
    const result = await submitReview({
      windowId: 'w-1',
      sourceItemId: 'src-1',
      action: 'confirm',
    });
    expect(result).toEqual({ ok: false, reason: 'window_closed' });
  });

  test('submitReview maps already_submitted', async () => {
    (globalThis.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: { code: 'already_submitted' } }),
    });
    const result = await submitReview({
      windowId: 'w-1',
      sourceItemId: 'src-1',
      action: 'confirm',
    });
    expect(result).toEqual({ ok: false, reason: 'already_submitted' });
  });

  test('credit copy respects the length tier (1 credit = 15 min)', () => {
    expect(creditLabelForTier(1)).toBe('1 credit · 15 min ad-free');
    expect(creditLabelForTier(2)).toBe('2 credits · 30 min ad-free');
  });
});
