import { STARTUP_CONSENT_VERSION } from '../../storage/startupConsent';
import { readPublicEnv } from '../../config/env';
import { getSupabase } from '../../services/supabase';

export type StartupConsentClientResult =
  | { ok: true }
  | {
      ok: false;
      code:
        | 'unavailable'
        | 'unauthorized'
        | 'invalid_payload'
        | 'outdated'
        | 'incomplete';
    };

/**
 * G2 startup consent gate — mirror the local acknowledgement to Supabase for
 * the signed-in user. Guests keep the acknowledgement device-local only.
 *
 * All three boxes (Terms, Privacy, 18+) must be true or the RPC returns
 * `startup_consent_incomplete` (400).
 */
export async function recordStartupConsent(input: {
  terms: boolean;
  privacy: boolean;
  age18Plus: boolean;
}): Promise<StartupConsentClientResult> {
  const env = readPublicEnv();
  const supabase = getSupabase();
  if (!env.authConfigured || !supabase) return { ok: false, code: 'unavailable' };
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const userId = data.session?.user?.id;
  if (!token || !userId) return { ok: false, code: 'unauthorized' };
  if (!input.terms || !input.privacy || !input.age18Plus) {
    return { ok: false, code: 'incomplete' };
  }
  const res = await fetch(
    `${env.supabaseUrl}/rest/v1/rpc/service_record_startup_consent`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        apikey: env.supabaseAnonKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        p_user_id: userId,
        p_version: STARTUP_CONSENT_VERSION,
        p_terms_accepted: true,
        p_privacy_accepted: true,
        p_age_confirmed: true,
      }),
    },
  );
  if (res.ok) return { ok: true };
  if (res.status === 400) return { ok: false, code: 'invalid_payload' };
  if (res.status === 401) return { ok: false, code: 'unauthorized' };
  // 409 or P0001 on outdated version
  return { ok: false, code: res.status === 409 ? 'outdated' : 'unavailable' };
}
