import { readPublicEnv } from '../../config/env';
import { getSupabase } from '../../services/supabase';

export type RewardedSession = {
  sessionToken: string;
  expiresAtMs: number;
};

/**
 * One-time server-owned rewarded session token.
 * Opaque token goes in AdMob SSV custom_data — no client secret.
 */
export async function requestRewardedSession(): Promise<
  | { ok: true; session: RewardedSession }
  | { ok: false; reason: string }
> {
  const env = readPublicEnv();
  const client = getSupabase();
  if (!env.authConfigured || !client) return { ok: false, reason: 'unavailable' };
  try {
    const { data: sessionData } = await client.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return { ok: false, reason: 'unauthorized' };

    const res = await fetch(
      `${env.supabaseUrl}/functions/v1/create-rewarded-session`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          apikey: env.supabaseAnonKey,
          'content-type': 'application/json',
        },
        body: '{}',
      },
    );
    if (res.status === 401) return { ok: false, reason: 'unauthorized' };
    if (!res.ok) return { ok: false, reason: 'unavailable' };
    const body = (await res.json()) as {
      session_token?: string;
      expires_at?: string;
    };
    if (!body.session_token || !body.expires_at) {
      return { ok: false, reason: 'invalid_payload' };
    }
    const expiresAtMs = Date.parse(body.expires_at);
    if (!Number.isFinite(expiresAtMs)) {
      return { ok: false, reason: 'invalid_payload' };
    }
    return {
      ok: true,
      session: { sessionToken: body.session_token, expiresAtMs },
    };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}
