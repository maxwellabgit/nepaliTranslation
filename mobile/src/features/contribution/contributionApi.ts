import { getRuntimeFeatureFlags } from '../../app/featureFlags';
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

export type ContributionSubmitAction =
  | 'looks_correct'
  | 'edit'
  | 'skip'
  | 'report_task';

export type SubmitContributionResult =
  | {
      ok: true;
      receipt_id: string | null;
      status: string;
      reward_label: string;
    }
  | {
      ok: false;
      reason:
        | 'unavailable'
        | 'sign_in'
        | 'consent'
        | 'consent_outdated'
        | 'age'
        | 'disabled'
        | 'lease_expired'
        | 'rate_limited'
        | 'invalid';
    };

async function authHeaders(): Promise<
  | { ok: true; token: string; url: string; anon: string }
  | { ok: false; reason: 'unavailable' | 'sign_in' }
> {
  const env = readPublicEnv();
  const supabase = getSupabase();
  if (!env.authConfigured || !supabase) return { ok: false, reason: 'unavailable' };
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, reason: 'sign_in' };
  return {
    ok: true,
    token,
    url: env.supabaseUrl,
    anon: env.supabaseAnonKey,
  };
}

function mapServerError(code: string | undefined): SubmitContributionResult['ok'] extends false
  ? never
  : SubmitContributionResult {
  switch (code) {
    case 'consent_required':
      return { ok: false, reason: 'consent' };
    case 'consent_outdated':
      return { ok: false, reason: 'consent_outdated' };
    case 'age_required':
      return { ok: false, reason: 'age' };
    case 'lease_expired':
      return { ok: false, reason: 'lease_expired' };
    case 'rate_limited':
      return { ok: false, reason: 'rate_limited' };
    case 'invalid_payload':
      return { ok: false, reason: 'invalid' };
    default:
      return { ok: false, reason: 'unavailable' };
  }
}

export async function fetchNextContribution(input: {
  signedIn: boolean;
  authConfigured: boolean;
}): Promise<
  | { ok: true; assignment: PublicContribution | null }
  | { ok: false; reason: 'unavailable' | 'sign_in' | 'consent' | 'age' | 'disabled' }
> {
  if (!getRuntimeFeatureFlags().contributionsEnabled) {
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
  const auth = await authHeaders();
  if (!auth.ok) return { ok: false, reason: auth.reason };
  const res = await fetch(`${auth.url}/functions/v1/get-next-contribution`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${auth.token}`,
      apikey: auth.anon,
      'content-type': 'application/json',
    },
    body: '{}',
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: { code?: string };
    } | null;
    const mapped = mapServerError(body?.error?.code);
    if (!mapped.ok && mapped.reason !== 'unavailable' && mapped.reason !== 'invalid') {
      return {
        ok: false,
        reason:
          mapped.reason === 'consent_outdated'
            ? 'consent'
            : mapped.reason === 'lease_expired' || mapped.reason === 'rate_limited'
              ? 'unavailable'
              : mapped.reason === 'consent' || mapped.reason === 'age'
                ? mapped.reason
                : 'unavailable',
      };
    }
    return { ok: false, reason: 'unavailable' };
  }
  const json = (await res.json()) as { assignment?: PublicContribution | null };
  return { ok: true, assignment: json.assignment ?? null };
}

export async function submitContribution(input: {
  signedIn: boolean;
  authConfigured: boolean;
  assignmentId: string;
  action: ContributionSubmitAction;
  responseText?: string;
  idempotencyKey: string;
}): Promise<SubmitContributionResult> {
  if (!getRuntimeFeatureFlags().contributionsEnabled) {
    return { ok: false, reason: 'disabled' };
  }
  const consent = await loadLocalConsent();
  const gate = canSubmitContribution({
    authConfigured: input.authConfigured,
    signedIn: input.signedIn,
    consentVersion: consent?.consent_version ?? null,
    ageConfirmed: Boolean(consent?.age_confirmed),
  });
  if (!gate.ok) {
    return {
      ok: false,
      reason: gate.reason === 'consent' ? 'consent' : gate.reason,
    };
  }
  if (input.action === 'edit' && !input.responseText?.trim()) {
    return { ok: false, reason: 'invalid' };
  }
  const auth = await authHeaders();
  if (!auth.ok) return { ok: false, reason: auth.reason };
  const res = await fetch(`${auth.url}/functions/v1/submit-contribution`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${auth.token}`,
      apikey: auth.anon,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      assignment_id: input.assignmentId,
      action: input.action,
      response_text: input.responseText,
      idempotency_key: input.idempotencyKey,
    }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: { code?: string };
    } | null;
    return mapServerError(body?.error?.code);
  }
  const json = (await res.json()) as {
    receipt_id?: string | null;
    status?: string;
    reward_label?: string;
  };
  return {
    ok: true,
    receipt_id: json.receipt_id ?? null,
    status: json.status ?? 'received',
    reward_label: json.reward_label ?? 'Earn 1–6 credits after validation',
  };
}

export function newIdempotencyKey(): string {
  return `contrib_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
