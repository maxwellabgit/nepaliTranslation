import { readPublicEnv } from '../config/env';
import { getSupabase } from './supabase';
import {
  markFailed,
  markSynced,
  pendingDrafts,
  type ContributionDraft,
} from '../storage/contributionOutbox';

export type FlushResult =
  | { ok: true; synced: number; failed: number }
  | { ok: false; reason: 'unavailable' | 'unauthorized' };

const MAX_BATCH = 20;

function directionFor(draft: ContributionDraft): 'en-ne' | 'ne-en' {
  return draft.source_lang === 'en' ? 'en-ne' : 'ne-en';
}

async function postReport(
  draft: ContributionDraft,
  token: string,
  env: { supabaseUrl: string; supabaseAnonKey: string },
): Promise<boolean> {
  const res = await fetch(`${env.supabaseUrl}/functions/v1/submit-translation-report`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      apikey: env.supabaseAnonKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      source_text: draft.source_text,
      model_output: draft.model_output,
      correction_text: draft.correction_text,
      direction: directionFor(draft),
      formality: draft.formality,
      script: draft.script,
      surface: draft.surface,
      idempotency_key: draft.idempotency_key,
      consent_version: draft.consent_version,
      metadata: { app: 'neptranslate', legacy_tag: draft.legacy_tag ?? null },
    }),
  });
  return res.ok || res.status === 409;
}

/** Uploads only pending user-submitted drafts. Never uploads ordinary history. */
export async function flushPendingDrafts(): Promise<FlushResult> {
  const env = readPublicEnv();
  const supabase = getSupabase();
  if (!env.authConfigured || !supabase) return { ok: false, reason: 'unavailable' };
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, reason: 'unauthorized' };

  const pending = (await pendingDrafts()).slice(0, MAX_BATCH);
  let synced = 0;
  let failed = 0;
  for (const draft of pending) {
    if (!draft.consent_version) {
      await markFailed(draft.idempotency_key);
      failed += 1;
      continue;
    }
    try {
      const ok = await postReport(draft, token, env);
      if (ok) {
        await markSynced(draft.idempotency_key);
        synced += 1;
      } else {
        await markFailed(draft.idempotency_key);
        failed += 1;
      }
    } catch {
      await markFailed(draft.idempotency_key);
      failed += 1;
    }
  }
  return { ok: true, synced, failed };
}
