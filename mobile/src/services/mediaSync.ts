import { readPublicEnv } from '../config/env';
import { CONTRIBUTION_CONSENT_VERSION } from '../features/auth/consent';
import { sessionInactiveNow } from '../features/auth/sessionExpiry';
import { loadLocalConsent } from '../storage/contributionConsent';
import { loadSharingToggles } from '../storage/sharingToggles';
import { getSupabase } from './supabase';
import {
  computeMediaNextAttemptAt,
  markMediaRejected,
  markMediaRetry,
  markMediaSynced,
  markMediaSyncing,
  pendingMediaItems,
  readCancelGeneration,
  type MediaOutboxItem,
} from '../storage/mediaOutbox';

export type MediaFlushResult =
  | { ok: true; synced: number; failed: number; rejected: number }
  | { ok: false; reason: 'unavailable' | 'unauthorized' };

const MAX_BATCH = 5;
const FETCH_TIMEOUT_MS = 30_000;

export type MediaUploadOutcome =
  | { kind: 'synced' }
  | { kind: 'retry'; code: string }
  | { kind: 'rejected'; code: string };

function classifyHttpStatus(status: number, bodyCode?: string): MediaUploadOutcome {
  if (status === 409 || (status >= 200 && status < 300)) {
    return { kind: 'synced' };
  }
  if (status >= 500 || status === 408 || status === 429) {
    return { kind: 'retry', code: bodyCode ?? `http_${status}` };
  }
  if (
    bodyCode === 'flag_disabled' ||
    bodyCode === 'sharing_disabled' ||
    bodyCode === 'consent_required' ||
    bodyCode === 'consent_outdated' ||
    bodyCode === 'age_required'
  ) {
    return { kind: 'rejected', code: bodyCode };
  }
  if (status >= 400 && status < 500) {
    return { kind: 'rejected', code: bodyCode ?? `http_${status}` };
  }
  return { kind: 'retry', code: bodyCode ?? `http_${status}` };
}

async function readLocalBytes(
  uri: string,
  fetchImpl: typeof fetch,
): Promise<ArrayBuffer | null> {
  try {
    const res = await fetchImpl(uri);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

export async function uploadMediaItem(
  item: MediaOutboxItem,
  token: string,
  env: { supabaseUrl: string; supabaseAnonKey: string },
  fetchImpl: typeof fetch = fetch,
  stillAuthorized: () => Promise<boolean> = async () => true,
): Promise<MediaUploadOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const createRes = await fetchImpl(
      `${env.supabaseUrl}/functions/v1/create-media-upload`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          apikey: env.supabaseAnonKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          kind: item.kind,
          idempotency_key: item.idempotency_key,
          content_type: item.content_type,
          byte_size: item.byte_size,
          metadata: item.metadata,
        }),
        signal: controller.signal,
      },
    );
    let createBody: {
      media_id?: string;
      object_path?: string;
      upload_url?: string | null;
      token?: string | null;
      status?: string;
      error?: { code?: string };
      code?: string;
    } = {};
    try {
      createBody = (await createRes.json()) as typeof createBody;
    } catch {
      createBody = {};
    }
    const createCode = createBody.error?.code ?? createBody.code;
    if (!createRes.ok) {
      return classifyHttpStatus(createRes.status, createCode);
    }
    if (!createBody.media_id) {
      return { kind: 'retry', code: 'missing_media_id' };
    }

    await markMediaSyncing(item.idempotency_key, {
      media_id: createBody.media_id,
      object_path: createBody.object_path ?? null,
    });

    if (createBody.status !== 'uploaded' && createBody.upload_url && createBody.token) {
      const bytes = await readLocalBytes(item.local_uri, fetchImpl);
      if (!bytes) {
        return { kind: 'retry', code: 'local_file_missing' };
      }
      const putRes = await fetchImpl(createBody.upload_url, {
        method: 'PUT',
        headers: {
          'content-type': item.content_type,
          authorization: `Bearer ${createBody.token}`,
          'x-upsert': 'true',
        },
        body: bytes,
        signal: controller.signal,
      });
      if (!putRes.ok) {
        if (putRes.status >= 500 || putRes.status === 408 || putRes.status === 429) {
          return { kind: 'retry', code: `upload_${putRes.status}` };
        }
        return { kind: 'rejected', code: `upload_${putRes.status}` };
      }
    }

    if (!(await stillAuthorized())) {
      return { kind: 'rejected', code: 'sharing_disabled' };
    }

    const completeRes = await fetchImpl(
      `${env.supabaseUrl}/functions/v1/complete-media-upload`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          apikey: env.supabaseAnonKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ media_id: createBody.media_id }),
        signal: controller.signal,
      },
    );
    let completeCode: string | undefined;
    try {
      const json = (await completeRes.json()) as {
        error?: { code?: string };
        code?: string;
      };
      completeCode = json.error?.code ?? json.code;
    } catch {
      completeCode = undefined;
    }
    return classifyHttpStatus(completeRes.status, completeCode);
  } catch (err) {
    const name = err instanceof Error ? err.name : '';
    const code = name === 'AbortError' ? 'timeout' : 'network_error';
    return { kind: 'retry', code };
  } finally {
    clearTimeout(timer);
  }
}

async function applyOutcome(
  item: MediaOutboxItem,
  outcome: MediaUploadOutcome,
): Promise<'synced' | 'failed' | 'rejected'> {
  if (outcome.kind === 'synced') {
    await markMediaSynced(item.idempotency_key);
    return 'synced';
  }
  if (outcome.kind === 'rejected') {
    await markMediaRejected(item.idempotency_key, outcome.code);
    return 'rejected';
  }
  const nextAttempt = (item.attemptCount ?? 0) + 1;
  await markMediaRetry(
    item.idempotency_key,
    outcome.code,
    computeMediaNextAttemptAt(nextAttempt),
  );
  return 'failed';
}

let flushMutex: Promise<MediaFlushResult> | null = null;

async function doFlush(
  fetchImpl: typeof fetch = fetch,
): Promise<MediaFlushResult> {
  const env = readPublicEnv();
  const supabase = getSupabase();
  if (!env.authConfigured || !supabase) {
    return { ok: false, reason: 'unavailable' };
  }
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const userId = data.session?.user?.id;
  if (!token || !userId) return { ok: false, reason: 'unauthorized' };
  if (await sessionInactiveNow(userId)) {
    return { ok: false, reason: 'unauthorized' };
  }

  const sharing = await loadSharingToggles(userId);
  const consent = await loadLocalConsent();
  const generation = await readCancelGeneration(userId);
  const consentCurrent =
    consent?.consent_version === CONTRIBUTION_CONSENT_VERSION &&
    Boolean(consent?.age_confirmed);
  const pending = (await pendingMediaItems())
    .filter((item) => item.owner_id === userId)
    .slice(0, MAX_BATCH);
  let synced = 0;
  let failed = 0;
  let rejected = 0;

  for (const item of pending) {
    const live = await supabase.auth.getSession();
    if (live.data.session?.user?.id !== userId) break;
    const toggleOff =
      (item.kind === 'speech' && !sharing.speech) ||
      (item.kind === 'photo' && !sharing.photos);
    const generationStale =
      (item.cancellation_generation ?? 0) !== generation;
    const consentStale =
      !consentCurrent ||
      (item.consent_epoch ?? item.consent_version) !== CONTRIBUTION_CONSENT_VERSION;
    if (toggleOff || generationStale || consentStale) {
      const applied = await applyOutcome(item, {
        kind: 'rejected',
        code: toggleOff ? 'sharing_disabled' : 'consent_outdated',
      });
      if (applied === 'rejected') rejected += 1;
      continue;
    }
    await markMediaSyncing(item.idempotency_key);
    const outcome = await uploadMediaItem(
      item,
      token,
      {
        supabaseUrl: env.supabaseUrl,
        supabaseAnonKey: env.supabaseAnonKey,
      },
      fetchImpl,
      async () => {
        const live = await supabase.auth.getSession();
        if (live.data.session?.user?.id !== userId) return false;
        if (await sessionInactiveNow(userId)) return false;
        const liveSharing = await loadSharingToggles(userId);
        const liveConsent = await loadLocalConsent();
        const liveGeneration = await readCancelGeneration(userId);
        const kindAllowed =
          item.kind === 'speech' ? liveSharing.speech : liveSharing.photos;
        return (
          kindAllowed &&
          liveGeneration === generation &&
          liveConsent?.consent_version === CONTRIBUTION_CONSENT_VERSION &&
          Boolean(liveConsent?.age_confirmed)
        );
      },
    );
    const applied = await applyOutcome(item, outcome);
    if (applied === 'synced') synced += 1;
    else if (applied === 'rejected') rejected += 1;
    else failed += 1;
  }

  return { ok: true, synced, failed, rejected };
}

/** Mutex-protected media flush. Never blocks translate callers awaiting this. */
export async function flushPendingMedia(
  fetchImpl: typeof fetch = fetch,
): Promise<MediaFlushResult> {
  if (flushMutex) return flushMutex;
  flushMutex = doFlush(fetchImpl).finally(() => {
    flushMutex = null;
  });
  return flushMutex;
}

export function __resetMediaFlushMutexForTests(): void {
  flushMutex = null;
}
