import { readPublicEnv } from '../../config/env';
import { getSupabase } from '../../services/supabase';

export type DeletionClientResult =
  | { ok: true }
  | { ok: false; code: 'unavailable' | 'unauthorized' | 'deletion_incomplete' };

/** Does not touch on-device translation history. */
export async function requestAccountDeletion(input: {
  authorizationCode?: string;
}): Promise<DeletionClientResult> {
  const env = readPublicEnv();
  const supabase = getSupabase();
  if (!env.authConfigured || !supabase) return { ok: false, code: 'unavailable' };
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, code: 'unauthorized' };
  const res = await fetch(`${env.supabaseUrl}/functions/v1/delete-account`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      apikey: env.supabaseAnonKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      authorization_code: input.authorizationCode,
    }),
  });
  if (res.ok) return { ok: true };
  return { ok: false, code: 'deletion_incomplete' };
}
