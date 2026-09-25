import { readPublicEnv } from '../../config/env';
import { getSupabase } from '../../services/supabase';

export type AccountSummaryClient = {
  consentVersion: string | null;
  ageConfirmed: boolean;
  receiptCount: number;
  lifetimeCredits: number;
  earnedAdFreeUntil: string | null;
  deletionRequestedAt: string | null;
  deletionDueAt: string | null;
  deletionStage: string | null;
  deletionCompletedAt: string | null;
  nyRewardCloseAt: string | null;
};

export type AccountSummaryResult =
  | { ok: true; summary: AccountSummaryClient }
  | { ok: false; code: 'unavailable' | 'unauthorized' };

/** Load consent / account summary for Settings and post–sign-in refresh. */
export async function fetchAccountSummary(): Promise<AccountSummaryResult> {
  const env = readPublicEnv();
  const supabase = getSupabase();
  if (!env.authConfigured || !supabase) return { ok: false, code: 'unavailable' };
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, code: 'unauthorized' };
  try {
    const res = await fetch(`${env.supabaseUrl}/functions/v1/account-summary`, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${token}`,
        apikey: env.supabaseAnonKey,
        accept: 'application/json',
      },
    });
    if (res.status === 401) return { ok: false, code: 'unauthorized' };
    if (!res.ok) return { ok: false, code: 'unavailable' };
    const body = (await res.json()) as {
      consent_version?: string | null;
      age_confirmed_at?: string | null;
      receipt_count?: number;
      lifetime_credits?: number;
      earned_ad_free_until?: string | null;
      deletion_requested_at?: string | null;
      deletion_due_at?: string | null;
      deletion_stage?: string | null;
      deletion_completed_at?: string | null;
      ny_reward_close_at?: string | null;
    };
    return {
      ok: true,
      summary: {
        consentVersion: body.consent_version ?? null,
        ageConfirmed: Boolean(body.age_confirmed_at),
        receiptCount: typeof body.receipt_count === 'number' ? body.receipt_count : 0,
        lifetimeCredits:
          typeof body.lifetime_credits === 'number' ? body.lifetime_credits : 0,
        earnedAdFreeUntil: body.earned_ad_free_until ?? null,
        deletionRequestedAt: body.deletion_requested_at ?? null,
        deletionDueAt: body.deletion_due_at ?? null,
        deletionStage: body.deletion_stage ?? null,
        deletionCompletedAt: body.deletion_completed_at ?? null,
        nyRewardCloseAt: body.ny_reward_close_at ?? null,
      },
    };
  } catch {
    return { ok: false, code: 'unavailable' };
  }
}
