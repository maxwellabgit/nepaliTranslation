import { CONTRIBUTION_CONSENT_VERSION } from './consent';
import { readPublicEnv } from '../../config/env';
import { getSupabase } from '../../services/supabase';
import { saveLocalConsent } from '../../storage/contributionConsent';

export type ConsentClientResult =
  | { ok: true }
  | { ok: false; code: 'unavailable' | 'unauthorized' | 'invalid_payload' };

/** Records specific opt-in only for the same owner with no later withdrawal. */
export async function recordContributionConsent(expectedOwner?: string, guard?: () => boolean): Promise<ConsentClientResult> {
  const env = readPublicEnv();
  const supabase = getSupabase();
  if (!env.authConfigured || !supabase) return { ok: false, code: 'unavailable' };
  try {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const owner = data.session?.user.id;
  if (!owner || (expectedOwner && expectedOwner !== owner) || (guard && !guard())) return { ok: false, code: 'unauthorized' };
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
  if (res.ok) {
    const live = await supabase.auth.getSession();
    if (live.data.session?.user.id !== owner || (guard && !guard())) return { ok: false, code: 'unauthorized' };
    const consent = await saveLocalConsent(true, owner, guard);
    return consent ? { ok: true } : { ok: false, code: 'unauthorized' };
  }
  if (res.status === 400) return { ok: false, code: 'invalid_payload' };
  if (res.status === 401) return { ok: false, code: 'unauthorized' };
  return { ok: false, code: 'unavailable' };
  } catch { return { ok: false, code: 'unavailable' }; }
}
