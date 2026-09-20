import { DEFAULT_FEATURE_FLAGS } from '../../app/featureFlags';
import { canSubmitContribution } from '../auth/consent';
import { readPublicEnv } from '../../config/env';
import { getSupabase } from '../../services/supabase';
import { loadLocalConsent } from '../../storage/contributionConsent';

export type PublicContribution = {
  public_task_id: string;
  source_text: string;
  model_output: string;
  direction: string;
  formality: string;
  script: string;
  reward_label: string;
  assignment_id?: string;
};

export async function fetchNextContribution(input: {
  signedIn: boolean;
  authConfigured: boolean;
}): Promise<
  | { ok: true; assignment: PublicContribution | null }
  | { ok: false; reason: 'unavailable' | 'sign_in' | 'consent' | 'age' | 'disabled' }
> {
  if (!DEFAULT_FEATURE_FLAGS.contributionsEnabled) {
    return { ok: false, reason: 'disabled' };
  }
  const consent = await loadLocalConsent();
  const gate = canSubmitContribution({
    authConfigured: input.authConfigured,
    signedIn: input.signedIn,
    consentVersion: consent?.consent_version ?? null,
    ageConfirmed: Boolean(consent?.age_confirmed),
  });
  if (!gate.ok) return { ok: false, reason: gate.reason };
  const env = readPublicEnv();
  const supabase = getSupabase();
  if (!env.authConfigured || !supabase) return { ok: false, reason: 'unavailable' };
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, reason: 'sign_in' };
  const res = await fetch(`${env.supabaseUrl}/functions/v1/get-next-contribution`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      apikey: env.supabaseAnonKey,
      'content-type': 'application/json',
    },
    body: '{}',
  });
  if (!res.ok) return { ok: false, reason: 'unavailable' };
  const json = await res.json() as { assignment?: PublicContribution | null };
  return { ok: true, assignment: json.assignment ?? null };
}
