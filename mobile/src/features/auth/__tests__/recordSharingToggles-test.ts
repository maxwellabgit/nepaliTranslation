import { getSupabase } from '../../../services/supabase';
import { readPublicEnv } from '../../../config/env';
import { recordSharingToggles } from '../recordSharingToggles';

jest.mock('../../../config/env', () => ({ readPublicEnv: jest.fn() }));

const mockEnv = readPublicEnv as jest.Mock;
const mockSupabase = getSupabase as jest.Mock;

describe('sharing authorization at the account boundary', () => {
  beforeEach(() => {
    mockEnv.mockReturnValue({
      authConfigured: true,
      supabaseUrl: 'https://example.supabase.co',
      supabaseAnonKey: 'public-key',
    });
    globalThis.fetch = jest.fn() as typeof fetch;
  });

  it('cannot write account choices as a guest or with an incomplete session', async () => {
    mockSupabase.mockReturnValue({ auth: { getSession: async () => ({
      data: { session: { access_token: 'token-without-owner' } },
    }) } });
    expect(await recordSharingToggles({ speech: true, photos: true })).toEqual({ ok: false });
    mockSupabase.mockReturnValue(null);
    expect(await recordSharingToggles({ speech: true, photos: true })).toEqual({ ok: false });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('uses the authenticated account ID and sends both default-off choices', async () => {
    mockSupabase.mockReturnValue({ auth: { getSession: async () => ({
      data: { session: { access_token: 'signed-token', user: { id: 'account-A' } } },
    }) } });
    (globalThis.fetch as jest.Mock).mockResolvedValue({ ok: true });
    expect(await recordSharingToggles({ speech: false, photos: true })).toEqual({ ok: true });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://example.supabase.co/rest/v1/rpc/service_set_sharing_toggles',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ authorization: 'Bearer signed-token' }),
        body: JSON.stringify({ p_user_id: 'account-A', p_speech: false, p_photos: true }),
      }),
    );
  });

  it('does not report success when the server rejects or the request fails', async () => {
    mockSupabase.mockReturnValue({ auth: { getSession: async () => ({
      data: { session: { access_token: 'token', user: { id: 'A' } } },
    }) } });
    (globalThis.fetch as jest.Mock).mockResolvedValueOnce({ ok: false })
      .mockRejectedValueOnce(new Error('offline'));
    expect(await recordSharingToggles({ speech: true, photos: false })).toEqual({ ok: false });
    expect(await recordSharingToggles({ speech: true, photos: false })).toEqual({ ok: false });
  });
});
