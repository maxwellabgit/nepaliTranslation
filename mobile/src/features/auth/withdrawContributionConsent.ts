import { readPublicEnv } from '../../config/env';
import { getSupabase } from '../../services/supabase';

/**
 * R4 client-side wrapper for `service_withdraw_contribution_consent`.
 *
 * The RPC preserves the account but stops new uploads, marks queued media
 * pending_delete, adds a `contribution_consent_withdrawn` alert row, and
 * schedules the 30-day linked-data purge deadline. Returns the scheduled
 * `deletion_due_at` timestamp on success so the UI can render a
 * cancellation policy message.
 *
 * Guests / unconfigured environments short-circuit with `unavailable` and
 * do not touch the network — core translation must stay usable.
 */
export type WithdrawContributionConsentResult =
  | { ok: true; deletionDueAt: string }
  | {
      ok: false;
      code:
        | 'unavailable'
        | 'unauthorized'
        | 'forbidden'
        | 'invalid_payload';
    };

export async function withdrawContributionConsent(): Promise<WithdrawContributionConsentResult> {
  const env = readPublicEnv();
  const supabase = getSupabase();
  if (!env.authConfigured || !supabase) return { ok: false, code: 'unavailable' };
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const userId = data.session?.user?.id;
  if (!token || !userId) return { ok: false, code: 'unauthorized' };
  const res = await fetch(
    `${env.supabaseUrl}/rest/v1/rpc/service_withdraw_contribution_consent`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        apikey: env.supabaseAnonKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ p_user_id: userId }),
    },
  );
  if (res.ok) {
    const body = (await res.json().catch(() => null)) as
      | { deletion_due_at?: string }
      | null;
    return {
      ok: true,
      deletionDueAt:
        typeof body?.deletion_due_at === 'string'
          ? body.deletion_due_at
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }
  if (res.status === 400) return { ok: false, code: 'invalid_payload' };
  if (res.status === 401) return { ok: false, code: 'unauthorized' };
  if (res.status === 403) return { ok: false, code: 'forbidden' };
  return { ok: false, code: 'unavailable' };
}
