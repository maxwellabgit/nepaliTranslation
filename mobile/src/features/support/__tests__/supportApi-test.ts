import { supportRpc } from '../supportApi';
import { getSupabase } from '../../../services/supabase';
import { readPublicEnv } from '../../../config/env';
jest.mock('../../../config/env', () => ({ readPublicEnv: jest.fn() }));
const client = getSupabase as jest.Mock; const env = readPublicEnv as jest.Mock;
beforeEach(() => { env.mockReturnValue({ authConfigured: true, supabaseUrl: 'https://example.supabase.co', supabaseAnonKey: 'public' });
  client.mockReturnValue({ auth: { getSession: async () => ({ data: { session: { user: { id: 'A' }, access_token: 'token' } } }) } });
  globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ id: 'request' }) });
});
it('never adopts a support draft from a different guest identity', async () => {
  await expect(supportRpc('B', 'support_submit', { p_message: 'private draft' })).rejects.toThrow('unauthorized');
  expect(fetch).not.toHaveBeenCalled();
});
it('sends only the explicit message/category/version and client ID, without model permission or automatic attachments', async () => {
  const payload = { p_client_id: 'nonce', p_message: 'help', p_category: 'ad', p_app_version: '1.7.0' };
  await expect(supportRpc('A', 'support_submit', payload)).resolves.toEqual({ id: 'request' });
  expect(fetch).toHaveBeenCalledWith('https://example.supabase.co/rest/v1/rpc/support_submit', expect.objectContaining({ body: JSON.stringify(payload) }));
});
it('does not claim delivery when unavailable, offline or rejected', async () => {
  (fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 500 });
  await expect(supportRpc('A', 'support_submit', {})).rejects.toThrow('unavailable');
  (fetch as jest.Mock).mockRejectedValueOnce(Error('offline'));
  await expect(supportRpc('A', 'support_submit', {})).rejects.toThrow('offline');
  env.mockReturnValue({ authConfigured: false });
  await expect(supportRpc('A', 'support_list')).rejects.toThrow('unavailable');
});
