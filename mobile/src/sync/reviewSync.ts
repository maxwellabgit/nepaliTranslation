import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MeaningReview } from '../storage/meaningReviews';

const CONFIG_KEY = 'neptranslate.review_sync.config.v1';
const QUEUE_KEY = 'neptranslate.review_sync.queue.v1';
const STATUS_KEY = 'neptranslate.review_sync.status.v1';

/** Flush when this many reviews are pending (or sooner via timer / manual). */
export const BATCH_SIZE = 1;
/** Cap reviews per HTTP request. */
export const MAX_BATCH_UPLOAD = 50;
/** Debounce flush after the latest enqueue (ms). */
export const BATCH_DEBOUNCE_MS = 3_000;

export type ReviewSyncConfig = {
  enabled: boolean;
  /** e.g. https://xxxx.trycloudflare.com or http://192.168.1.10:8765 */
  endpointUrl: string;
  /** Shared secret; must match REVIEW_SYNC_SECRET on the PC server. */
  secret: string;
  deviceLabel: string;
};

export type ReviewSyncStatus = {
  pending: number;
  lastOkAt: string | null;
  lastError: string | null;
  lastBatchSize: number;
};

type QueueItem = MeaningReview & { queued_at: string };

const DEFAULT_CONFIG: ReviewSyncConfig = {
  enabled: false,
  endpointUrl: '',
  secret: '',
  deviceLabel: 'iphone',
};

let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;

export async function loadReviewSyncConfig(): Promise<ReviewSyncConfig> {
  try {
    const raw = await AsyncStorage.getItem(CONFIG_KEY);
    if (!raw) return { ...DEFAULT_CONFIG };
    return { ...DEFAULT_CONFIG, ...(JSON.parse(raw) as Partial<ReviewSyncConfig>) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function saveReviewSyncConfig(config: ReviewSyncConfig): Promise<void> {
  await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export async function loadReviewSyncStatus(): Promise<ReviewSyncStatus> {
  try {
    const raw = await AsyncStorage.getItem(STATUS_KEY);
    const queue = await loadQueue();
    if (!raw) {
      return { pending: queue.length, lastOkAt: null, lastError: null, lastBatchSize: 0 };
    }
    const parsed = JSON.parse(raw) as ReviewSyncStatus;
    return { ...parsed, pending: queue.length };
  } catch {
    return { pending: 0, lastOkAt: null, lastError: null, lastBatchSize: 0 };
  }
}

async function saveStatus(partial: Partial<ReviewSyncStatus>): Promise<ReviewSyncStatus> {
  const cur = await loadReviewSyncStatus();
  const next: ReviewSyncStatus = { ...cur, ...partial };
  await AsyncStorage.setItem(STATUS_KEY, JSON.stringify(next));
  return next;
}

async function loadQueue(): Promise<QueueItem[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QueueItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveQueue(items: QueueItem[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

function normalizeEndpoint(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  if (trimmed.endsWith('/v1/reviews')) return trimmed;
  return `${trimmed}/v1/reviews`;
}

/**
 * Drop a pending upload (e.g. after Undo). Already-sent reviews are unchanged.
 */
export async function dropQueuedReviewSync(meaningId: string): Promise<void> {
  const queue = await loadQueue();
  const next = queue.filter((q) => q.meaning_id !== meaningId);
  if (next.length === queue.length) return;
  await saveQueue(next);
  await saveStatus({ pending: next.length });
}

/**
 * Queue a completed review for upload. Flushes in batches when enabled.
 */
export async function enqueueReviewSync(review: MeaningReview): Promise<void> {
  const config = await loadReviewSyncConfig();
  const queue = await loadQueue();
  const withoutDup = queue.filter((q) => q.meaning_id !== review.meaning_id);
  withoutDup.push({ ...review, queued_at: new Date().toISOString() });
  await saveQueue(withoutDup);
  await saveStatus({ pending: withoutDup.length });

  if (!config.enabled || !config.endpointUrl.trim()) return;

  if (withoutDup.length >= BATCH_SIZE) {
    void flushReviewSync({ reason: 'batch_full' });
    return;
  }

  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushReviewSync({ reason: 'debounce' });
  }, BATCH_DEBOUNCE_MS);
}

export type FlushResult =
  | { ok: true; sent: number; skipped: boolean }
  | { ok: false; error: string; sent: number };

/**
 * POST pending reviews to the PC sync server. Safe to call often.
 */
export async function flushReviewSync(opts?: {
  reason?: string;
  force?: boolean;
}): Promise<FlushResult> {
  if (flushing) return { ok: true, sent: 0, skipped: true };
  flushing = true;
  try {
    const config = await loadReviewSyncConfig();
    const queue = await loadQueue();
    if (!queue.length) {
      await saveStatus({ pending: 0 });
      return { ok: true, sent: 0, skipped: true };
    }
    if (!config.enabled && !opts?.force) {
      return { ok: false, error: 'Sync is disabled', sent: 0 };
    }
    const endpoint = normalizeEndpoint(config.endpointUrl);
    if (!endpoint) {
      const err = 'Set a sync endpoint URL in Advanced → Review sync';
      await saveStatus({ lastError: err, pending: queue.length });
      return { ok: false, error: err, sent: 0 };
    }
    if (!config.secret.trim()) {
      const err = 'Set a sync secret in Advanced → Review sync';
      await saveStatus({ lastError: err, pending: queue.length });
      return { ok: false, error: err, sent: 0 };
    }

    const batch = queue.slice(0, MAX_BATCH_UPLOAD);
    const reviews: Record<string, MeaningReview> = {};
    for (const item of batch) {
      const { queued_at: _q, ...review } = item;
      reviews[review.meaning_id] = review;
    }

    const body = {
      export_kind: 'meaning_unit_reviews',
      exported_at: new Date().toISOString(),
      sync: {
        device_label: config.deviceLabel || 'iphone',
        reason: opts?.reason ?? 'flush',
        batch_size: batch.length,
      },
      model_family: 'indictrans2-dist-200M',
      n_completed: Object.keys(reviews).length,
      reviews,
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Review-Sync-Secret': config.secret.trim(),
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const err = `HTTP ${res.status}${text ? `: ${text.slice(0, 160)}` : ''}`;
      await saveStatus({ lastError: err, pending: queue.length });
      return { ok: false, error: err, sent: 0 };
    }

    const remaining = queue.slice(batch.length);
    await saveQueue(remaining);
    await saveStatus({
      pending: remaining.length,
      lastOkAt: new Date().toISOString(),
      lastError: null,
      lastBatchSize: batch.length,
    });

    // Keep draining if more than one batch piled up.
    if (remaining.length >= BATCH_SIZE) {
      flushing = false;
      return flushReviewSync({ reason: 'drain' });
    }

    return { ok: true, sent: batch.length, skipped: false };
  } catch (e) {
    const err = e instanceof Error ? e.message : 'Network error';
    const queue = await loadQueue();
    await saveStatus({ lastError: err, pending: queue.length });
    return { ok: false, error: err, sent: 0 };
  } finally {
    flushing = false;
  }
}
