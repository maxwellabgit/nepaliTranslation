import { readPublicEnv } from '../../config/env';
import { getSupabase } from '../../services/supabase';

/**
 * G1 public review pool client.
 *
 * Contract (see .governance/V1_G0_DECISIONS.md D1/D2/D6):
 *   * One global 10-item window per America/New_York review day.
 *   * All eligible signed-in reviewers see the SAME ten items.
 *   * Rotation at 5:00 PM America/New_York closes the window, grants
 *     credits (1/2 credits by length tier at assignment; 1 credit = 15
 *     minutes ad-free), and opens the next window with a fresh random 10.
 *   * Copy shown in-app is "Today's 10" with subtitle "Review translations".
 *
 * Not called for guests; the mobile Review surface is signed-in only.
 */

export type ReviewItem = {
  slot: number;
  source_item_id: string;
  direction: 'en-ne' | 'ne-en';
  register: string;
  script: string;
  source_text: string;
  proposed_target: string | null;
  length_tier: 1 | 2;
  scheduled_credits: 1 | 2;
};

export type ReviewWindowSummary = {
  window_id: string;
  ny_close_at: string;
  size: number;
};

export type ReviewMine = {
  source_item_id: string;
  action: 'confirm' | 'edit' | 'skip' | 'report';
  corrected_text: string | null;
  reward_granted: boolean;
};

export type ReviewCurrent =
  | {
      ok: true;
      window: ReviewWindowSummary | null;
      items: ReviewItem[];
      mine: ReviewMine[];
    }
  | {
      ok: false;
      reason: 'unavailable' | 'sign_in' | 'window_closed';
    };

export type ReviewSubmitAction = 'confirm' | 'edit' | 'skip' | 'report';

export type ReviewSubmitResult =
  | { ok: true; submission: Record<string, unknown> }
  | {
      ok: false;
      reason:
        | 'unavailable'
        | 'sign_in'
        | 'window_closed'
        | 'already_submitted'
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

function mapError(code: string | undefined): ReviewSubmitResult {
  switch (code) {
    case 'sign_in_required':
    case 'unauthorized':
      return { ok: false, reason: 'sign_in' };
    case 'window_closed':
      return { ok: false, reason: 'window_closed' };
    case 'already_submitted':
      return { ok: false, reason: 'already_submitted' };
    case 'invalid_payload':
      return { ok: false, reason: 'invalid' };
    default:
      return { ok: false, reason: 'unavailable' };
  }
}

export async function fetchCurrentReviewWindow(): Promise<ReviewCurrent> {
  const auth = await authHeaders();
  if (!auth.ok) return { ok: false, reason: auth.reason };
  const res = await fetch(`${auth.url}/functions/v1/public-review`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${auth.token}`,
      apikey: auth.anon,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ op: 'current' }),
  });
  if (!res.ok) return { ok: false, reason: 'unavailable' };
  const body = (await res.json()) as {
    window?: ReviewWindowSummary | null;
    items?: ReviewItem[];
    mine?: ReviewMine[];
  };
  return {
    ok: true,
    window: body.window ?? null,
    items: body.items ?? [],
    mine: body.mine ?? [],
  };
}

/** First item the signed-in user has not already submitted in this window. */
export function firstUnsubmittedIndex(
  items: { source_item_id: string }[],
  mine: { source_item_id: string }[],
): number {
  const done = new Set(mine.map((row) => row.source_item_id));
  const index = items.findIndex((item) => !done.has(item.source_item_id));
  return index < 0 ? 0 : index;
}

export async function submitReview(input: {
  windowId: string;
  sourceItemId: string;
  action: ReviewSubmitAction;
  correctedText?: string;
}): Promise<ReviewSubmitResult> {
  if (input.action === 'edit' && !input.correctedText?.trim()) {
    return { ok: false, reason: 'invalid' };
  }
  const auth = await authHeaders();
  if (!auth.ok) return { ok: false, reason: auth.reason };
  const res = await fetch(`${auth.url}/functions/v1/public-review`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${auth.token}`,
      apikey: auth.anon,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      op: 'submit',
      window_id: input.windowId,
      source_item_id: input.sourceItemId,
      action: input.action,
      corrected_text: input.correctedText ?? null,
    }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: { code?: string };
    } | null;
    return mapError(body?.error?.code);
  }
  const body = (await res.json()) as { submission: Record<string, unknown> };
  return { ok: true, submission: body.submission };
}

export function creditLabelForTier(tier: 1 | 2): string {
  return tier === 2
    ? '2 credits · 30 min ad-free'
    : '1 credit · 15 min ad-free';
}
