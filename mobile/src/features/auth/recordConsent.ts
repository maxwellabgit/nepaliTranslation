import { CONTRIBUTION_CONSENT_VERSION } from './consent';
import { readPublicEnv } from '../../config/env';
import { getSupabase } from '../../services/supabase';

export type ConsentClientResult =
  | { ok: true }
  | { ok: false; code: 'unavailable' | 'unauthorized' | 'invalid_payload' };

/** Draft consent only. Does not enable contribution collection. */
export async function recordContributionConsent(): Promise<ConsentClientResult> {
  const env = readPublicEnv();
  const supabase = getSupabase();
  if (!env.authConfigured || !supabase) return { ok: false, code: 'unavailable' };
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, code: 'unauthorized' };
  const res = await fetch(`${env.supabaseUrl}/functions/v1/record-consent`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      apikey: env.supabaseAnonKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      consent_version: CONTRIBUTION_CONSENT_VERSION,
      age_confirmed: true,
    }),
  });
  if (res.ok) return { ok: true };
  if (res.status === 400) return { ok: false, code: 'invalid_payload' };
  if (res.status === 401) return { ok: false, code: 'unauthorized' };
  return { ok: false, code: 'unavailable' };
}
