import { readPublicEnv } from '../config/env';
import { getSupabase } from './supabase';
import {
  computeNextAttemptAt,
  markRejected,
  markRetry,
  markSynced,
  markSyncing,
  pendingDrafts,
  type ContributionDraft,
} from '../storage/contributionOutbox';

export type FlushResult =
  | { ok: true; synced: number; failed: number; rejected: number }
  | { ok: false; reason: 'unavailable' | 'unauthorized' };

const MAX_BATCH = 20;
const FETCH_TIMEOUT_MS = 25_000;

export type ReportOutcome =
  | { kind: 'synced' }
  | { kind: 'retry'; code: string }
  | { kind: 'rejected'; code: string };

function directionFor(draft: ContributionDraft): 'en-ne' | 'ne-en' {
  return draft.source_lang === 'en' ? 'en-ne' : 'ne-en';
}

function classifyHttpStatus(status: number, bodyCode?: string): ReportOutcome {
  if (status === 409 || (status >= 200 && status < 300)) {
    return { kind: 'synced' };
  }
  if (status >= 500 || status === 408 || status === 429) {
    return { kind: 'retry', code: bodyCode ?? `http_${status}` };
  }
  if (status >= 400 && status < 500) {
    return {
      kind: 'rejected',
      code: bodyCode ?? `http_${status}`,
    };
  }
  return { kind: 'retry', code: bodyCode ?? `http_${status}` };
}

export async function postTranslationReport(
  draft: ContributionDraft,
  token: string,
  env: { supabaseUrl: string; supabaseAnonKey: string },
  fetchImpl: typeof fetch = fetch,
): Promise<ReportOutcome> {
  if (!draft.formality || !draft.script) {
    return { kind: 'rejected', code: 'labels_required' };
  }
  if (!draft.consent_version) {
    return { kind: 'rejected', code: 'consent_required' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetchImpl(
      `${env.supabaseUrl}/functions/v1/submit-translation-report`,
      {
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
          metadata: {
            app: 'neptranslate',
            legacy_tag: draft.legacy_tag ?? null,
            local_fingerprint: draft.local_fingerprint,
            translation_method: draft.translation_method ?? null,
            model_version: draft.model_version ?? null,
          },
        }),
        signal: controller.signal,
      },
    );
    let bodyCode: string | undefined;
    try {
      const json = (await res.json()) as { code?: string; error?: string };
      bodyCode = json.code ?? json.error;
    } catch {
      bodyCode = undefined;
    }
    return classifyHttpStatus(res.status, bodyCode);
  } catch (err) {
    const name = err instanceof Error ? err.name : '';
    const code =
      name === 'AbortError' ? 'timeout' : 'network_error';
    return { kind: 'retry', code };
  } finally {
    clearTimeout(timer);
  }
}

let flushMutex: Promise<FlushResult> | null = null;

async function applyOutcome(
  draft: ContributionDraft,
  outcome: ReportOutcome,
): Promise<'synced' | 'failed' | 'rejected'> {
  if (outcome.kind === 'synced') {
    await markSynced(draft.idempotency_key);
    return 'synced';
  }
  if (outcome.kind === 'rejected') {
    await markRejected(draft.idempotency_key, outcome.code);
    return 'rejected';
  }
  const nextAttempt = (draft.attemptCount ?? 0) + 1;
  await markRetry(
    draft.idempotency_key,
    outcome.code,
    computeNextAttemptAt(nextAttempt),
  );
  return 'failed';
}

async function doFlush(
  fetchImpl: typeof fetch = fetch,
): Promise<FlushResult> {
  const env = readPublicEnv();
  const supabase = getSupabase();
  if (!env.authConfigured || !supabase) {
    return { ok: false, reason: 'unavailable' };
  }
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, reason: 'unauthorized' };

  const pending = (await pendingDrafts()).slice(0, MAX_BATCH);
  let synced = 0;
  let failed = 0;
  let rejected = 0;

  for (const draft of pending) {
    if (draft.status === 'draft') continue;
    await markSyncing(draft.idempotency_key);
    const outcome = await postTranslationReport(
      draft,
      token,
      {
        supabaseUrl: env.supabaseUrl,
        supabaseAnonKey: env.supabaseAnonKey,
      },
      fetchImpl,
    );
    const applied = await applyOutcome(draft, outcome);
    if (applied === 'synced') synced += 1;
    else if (applied === 'rejected') rejected += 1;
    else failed += 1;
  }

  return { ok: true, synced, failed, rejected };
}

/** Mutex-protected flush. Never uploads draft or legacy without explicit queue. */
export async function flushPendingDrafts(
  fetchImpl: typeof fetch = fetch,
): Promise<FlushResult> {
  if (flushMutex) return flushMutex;
  flushMutex = doFlush(fetchImpl).finally(() => {
    flushMutex = null;
  });
  return flushMutex;
}

/** Test helper: clear in-flight mutex between suites. */
export function __resetFlushMutexForTests(): void {
  flushMutex = null;
}
