import { getSupabase } from '../../services/supabase';
import { readPublicEnv } from '../../config/env';

export type SupportRequest = { id: string; category: 'general' | 'ad'; message: string; reply: string | null; created_at: string; replied_at: string | null };
/** Explicit support request only. Never attach history, recordings or consent. */
export async function supportRpc<T>(owner: string, method: 'support_submit' | 'support_list' | 'support_delete', body: Record<string, unknown> = {}): Promise<T> {
  const env = readPublicEnv();
  const client = getSupabase();
  if (!env.authConfigured || !client) throw Error('unavailable');
  const { data } = await client.auth.getSession();
  const session = data.session;
  if (!owner || session?.user.id !== owner || !session.access_token) throw Error('unauthorized');
  const result = await fetch(`${env.supabaseUrl}/rest/v1/rpc/${method}`, {
    method: 'POST', headers: { authorization: `Bearer ${session.access_token}`, apikey: env.supabaseAnonKey, 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!result.ok) throw Error(result.status === 429 ? 'rate_limited' : 'unavailable');
  return await result.json() as T;
}
