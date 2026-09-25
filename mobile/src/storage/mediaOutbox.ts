import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import type { MediaKind } from '../features/auth/consent';

export const MEDIA_OUTBOX_KEY = 'neptranslate.media_outbox.v1';

export type MediaOutboxStatus =
  | 'queued'
  | 'syncing'
  | 'retry'
  | 'synced'
  | 'rejected';

export type MediaOutboxItem = {
  id: string;
  idempotency_key: string;
  kind: MediaKind;
  /** Durable local file URI (copied before temp capture delete). */
  local_uri: string;
  content_type: string;
  byte_size: number;
  consent_version: string;
  /** Account that captured the file. Missing owner never uploads. */
  owner_id?: string | null;
  /** Consent version captured at enqueue. */
  consent_epoch?: string | null;
  /** Bumped on withdrawal, deletion, or a sharing toggle turning off. */
  cancellation_generation?: number;
  metadata: Record<string, unknown>;
  status: MediaOutboxStatus;
  media_id?: string | null;
  object_path?: string | null;
  created_at: string;
  updated_at: string;
  attemptCount?: number;
  lastAttemptAt?: string | null;
  nextAttemptAt?: string | null;
  lastErrorCode?: string | null;
};

function shortHash(seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export function newMediaIdempotencyKey(): string {
  try {
    if (typeof Crypto.randomUUID === 'function') {
      return Crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  return `media_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function asStatus(raw: unknown): MediaOutboxStatus {
  if (
    raw === 'queued' ||
    raw === 'syncing' ||
    raw === 'retry' ||
    raw === 'synced' ||
    raw === 'rejected'
  ) {
    return raw;
  }
  return 'queued';
}

function asKind(raw: unknown): MediaKind | null {
  return raw === 'speech' || raw === 'photo' ? raw : null;
}

export function normalizeMediaItem(raw: unknown): MediaOutboxItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const kind = asKind(row.kind);
  const local_uri = typeof row.local_uri === 'string' ? row.local_uri : '';
  const content_type =
    typeof row.content_type === 'string' ? row.content_type : '';
  const consent_version =
    typeof row.consent_version === 'string' ? row.consent_version : '';
  if (!kind || !local_uri || !content_type || !consent_version) return null;
  const byte_size =
    typeof row.byte_size === 'number' && row.byte_size > 0 ? row.byte_size : 0;
  if (byte_size <= 0) return null;
  const now = new Date().toISOString();
  const idempotency_key =
    typeof row.idempotency_key === 'string' && row.idempotency_key
      ? row.idempotency_key
      : newMediaIdempotencyKey();
  return {
    id:
      typeof row.id === 'string' && row.id
        ? row.id
        : `media_${shortHash(`${idempotency_key}|${now}`)}`,
    idempotency_key,
    kind,
    local_uri,
    content_type,
    byte_size,
    consent_version,
    owner_id: typeof row.owner_id === 'string' && row.owner_id ? row.owner_id : null,
    consent_epoch:
      typeof row.consent_epoch === 'string' && row.consent_epoch
        ? row.consent_epoch
        : consent_version,
    cancellation_generation:
      typeof row.cancellation_generation === 'number' &&
      row.cancellation_generation >= 0
        ? row.cancellation_generation
        : 0,
    metadata:
      row.metadata && typeof row.metadata === 'object'
        ? (row.metadata as Record<string, unknown>)
        : {},
    status: asStatus(row.status),
    media_id: typeof row.media_id === 'string' ? row.media_id : null,
    object_path: typeof row.object_path === 'string' ? row.object_path : null,
    created_at: typeof row.created_at === 'string' ? row.created_at : now,
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : now,
    attemptCount: typeof row.attemptCount === 'number' ? row.attemptCount : 0,
    lastAttemptAt:
      typeof row.lastAttemptAt === 'string' ? row.lastAttemptAt : null,
    nextAttemptAt:
      typeof row.nextAttemptAt === 'string' ? row.nextAttemptAt : null,
    lastErrorCode:
      typeof row.lastErrorCode === 'string' ? row.lastErrorCode : null,
  };
}

let mutationChain: Promise<unknown> = Promise.resolve();

export async function updateMediaOutbox<T>(
  mutator: (items: MediaOutboxItem[]) => { items: MediaOutboxItem[]; result: T },
): Promise<T> {
  const run = mutationChain.then(async () => {
    let items: MediaOutboxItem[] = [];
    try {
      const raw = await AsyncStorage.getItem(MEDIA_OUTBOX_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          items = parsed
            .map((row) => normalizeMediaItem(row))
            .filter((d): d is MediaOutboxItem => d != null);
        }
      }
    } catch {
      items = [];
    }
    const { items: next, result } = mutator(items);
    await AsyncStorage.setItem(MEDIA_OUTBOX_KEY, JSON.stringify(next));
    return result;
  });
  mutationChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function loadMediaOutbox(): Promise<MediaOutboxItem[]> {
  return updateMediaOutbox((items) => ({ items, result: items.slice() }));
}

export type EnqueueMediaInput = {
  idempotency_key?: string;
  kind: MediaKind;
  local_uri: string;
  content_type: string;
  byte_size: number;
  consent_version: string;
  owner_id?: string | null;
  consent_epoch?: string | null;
  cancellation_generation?: number;
  metadata?: Record<string, unknown>;
};

/** Auto-queue eligible media. Idempotent by key or local_uri among active rows. */
export async function enqueueMediaItem(
  input: EnqueueMediaInput,
): Promise<MediaOutboxItem> {
  return updateMediaOutbox((items) => {
    const now = new Date().toISOString();
    const byKey = input.idempotency_key
      ? items.find((d) => d.idempotency_key === input.idempotency_key)
      : undefined;
    const byUri =
      byKey ??
      items.find(
        (d) =>
          d.local_uri === input.local_uri &&
          d.kind === input.kind &&
          d.status !== 'synced' &&
          d.status !== 'rejected',
      );
    if (byUri) {
      const next: MediaOutboxItem = {
        ...byUri,
        ...input,
        id: byUri.id,
        idempotency_key: byUri.idempotency_key,
        metadata: input.metadata ?? byUri.metadata,
        status: byUri.status === 'synced' ? 'synced' : byUri.status,
        created_at: byUri.created_at,
        updated_at: now,
      };
      return {
        items: items.map((d) => (d.id === byUri.id ? next : d)),
        result: next,
      };
    }
    const item: MediaOutboxItem = {
      id: `media_${shortHash(`${input.local_uri}|${now}`)}`,
      idempotency_key: input.idempotency_key ?? newMediaIdempotencyKey(),
      kind: input.kind,
      local_uri: input.local_uri,
      content_type: input.content_type,
      byte_size: input.byte_size,
      consent_version: input.consent_version,
      owner_id: input.owner_id ?? null,
      consent_epoch: input.consent_epoch ?? input.consent_version,
      cancellation_generation: input.cancellation_generation ?? 0,
      metadata: input.metadata ?? {},
      status: 'queued',
      media_id: null,
      object_path: null,
      attemptCount: 0,
      lastAttemptAt: null,
      nextAttemptAt: null,
      lastErrorCode: null,
      created_at: now,
      updated_at: now,
    };
    return {
      items: [item, ...items].slice(0, 100),
      result: item,
    };
  });
}

export async function markMediaSynced(idempotencyKey: string): Promise<void> {
  await updateMediaOutbox((items) => ({
    items: items.map((d) =>
      d.idempotency_key === idempotencyKey
        ? {
            ...d,
            status: 'synced' as const,
            updated_at: new Date().toISOString(),
            lastErrorCode: null,
            nextAttemptAt: null,
          }
        : d,
    ),
    result: undefined,
  }));
}

export async function markMediaRejected(
  idempotencyKey: string,
  errorCode: string,
): Promise<void> {
  await updateMediaOutbox((items) => ({
    items: items.map((d) =>
      d.idempotency_key === idempotencyKey
        ? {
            ...d,
            status: 'rejected' as const,
            lastErrorCode: errorCode,
            updated_at: new Date().toISOString(),
            nextAttemptAt: null,
          }
        : d,
    ),
    result: undefined,
  }));
}

export async function markMediaRetry(
  idempotencyKey: string,
  errorCode: string,
  nextAttemptAt: string,
): Promise<void> {
  await updateMediaOutbox((items) => ({
    items: items.map((d) => {
      if (d.idempotency_key !== idempotencyKey) return d;
      const attemptCount = (d.attemptCount ?? 0) + 1;
      return {
        ...d,
        status: 'retry' as const,
        attemptCount,
        lastAttemptAt: new Date().toISOString(),
        nextAttemptAt,
        lastErrorCode: errorCode,
        updated_at: new Date().toISOString(),
      };
    }),
    result: undefined,
  }));
}

export async function markMediaSyncing(
  idempotencyKey: string,
  patch?: Partial<Pick<MediaOutboxItem, 'media_id' | 'object_path'>>,
): Promise<void> {
  await updateMediaOutbox((items) => ({
    items: items.map((d) =>
      d.idempotency_key === idempotencyKey
        ? {
            ...d,
            ...patch,
            status: 'syncing' as const,
            updated_at: new Date().toISOString(),
          }
        : d,
    ),
    result: undefined,
  }));
}

export async function pendingMediaItems(
  nowMs: number = Date.now(),
): Promise<MediaOutboxItem[]> {
  const items = await loadMediaOutbox();
  return items.filter((d) => {
    if (d.status === 'synced' || d.status === 'rejected') return false;
    if (d.status === 'queued' || d.status === 'syncing') return true;
    if (d.status === 'retry') {
      if (!d.nextAttemptAt) return true;
      return Date.parse(d.nextAttemptAt) <= nowMs;
    }
    return false;
  });
}

export function computeMediaNextAttemptAt(
  attemptCount: number,
  nowMs: number = Date.now(),
  random: () => number = Math.random,
): string {
  const exp = Math.max(0, attemptCount - 1);
  const baseMs = Math.min(15 * 60 * 1000, 1000 * 2 ** exp);
  const jitter = Math.floor(random() * baseMs * 0.25);
  return new Date(nowMs + baseMs + jitter).toISOString();
}

const CANCEL_GEN_KEY = 'neptranslate.media_cancel_generation.v1';

async function readGenerationStore(): Promise<Record<string, number>> {
  try {
    const raw = await AsyncStorage.getItem(CANCEL_GEN_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const next: Record<string, number> = {};
    for (const [userId, value] of Object.entries(parsed)) {
      if (typeof value === 'number' && value >= 0) next[userId] = value;
    }
    return next;
  } catch {
    return {};
  }
}

export async function readCancelGeneration(userId: string): Promise<number> {
  if (!userId) return 0;
  const store = await readGenerationStore();
  return store[userId] ?? 0;
}

export async function bumpCancelGeneration(userId: string): Promise<number> {
  if (!userId) return 0;
  const store = await readGenerationStore();
  const next = (store[userId] ?? 0) + 1;
  store[userId] = next;
  await AsyncStorage.setItem(CANCEL_GEN_KEY, JSON.stringify(store));
  return next;
}

/** Drop one account's pending rows and return local URIs to delete. */
export async function removeMediaForOwner(ownerId: string): Promise<string[]> {
  if (!ownerId) return [];
  return updateMediaOutbox((items) => {
    const removed = items.filter(
      (item) =>
        item.owner_id === ownerId &&
        item.status !== 'synced' &&
        item.status !== 'rejected',
    );
    return {
      items: items.filter((item) => !removed.some((row) => row.id === item.id)),
      result: removed.map((item) => item.local_uri),
    };
  });
}

/** Stop pending rows of one kind from transferring after that toggle turns off. */
export async function cancelPendingKind(
  ownerId: string,
  kind: 'speech' | 'photo',
): Promise<string[]> {
  if (!ownerId) return [];
  return updateMediaOutbox((items) => {
    const uris: string[] = [];
    const next = items.map((item) => {
      if (
        item.owner_id !== ownerId ||
        item.kind !== kind ||
        item.status === 'synced' ||
        item.status === 'rejected'
      ) {
        return item;
      }
      uris.push(item.local_uri);
      return {
        ...item,
        status: 'rejected' as const,
        lastErrorCode: 'sharing_disabled',
        nextAttemptAt: null,
        updated_at: new Date().toISOString(),
      };
    });
    return { items: next, result: uris };
  });
}

export async function clearMediaOutbox(): Promise<void> {
  await AsyncStorage.removeItem(MEDIA_OUTBOX_KEY);
}
