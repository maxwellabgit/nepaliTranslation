import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import type { Formality, NepaliScript } from '../mt/onDeviceTranslate';

export const OUTBOX_KEY = 'neptranslate.contribution_outbox.v1';
export const LEGACY_QUEUE_KEY = 'neptranslate.review_sync.queue.v1';
export const MODEL_VERSION = 'indictrans2-dist-200M';

export type OutboxSurface = 'live_translate' | 'history' | 'legacy-v1';
export type OutboxStatus =
  | 'draft'
  | 'queued'
  | 'syncing'
  | 'retry'
  | 'synced'
  | 'rejected';

export type ContributionDraft = {
  id: string;
  /** Random immutable UUID — server idempotency key. */
  idempotency_key: string;
  /** Local UX duplicate fingerprint only; never the server key. */
  local_fingerprint: string;
  surface: OutboxSurface;
  source_text: string;
  model_output: string;
  correction_text: string | null;
  source_lang: 'en' | 'ne';
  /** Null when legacy / unknown — must be set before submit. */
  formality: Formality | null;
  /** Null when legacy / unknown — must be set before submit. */
  script: NepaliScript | null;
  translation_method?: string | null;
  model_version?: string | null;
  consent_version: string | null;
  status: OutboxStatus;
  created_at: string;
  updated_at: string;
  attemptCount?: number;
  lastAttemptAt?: string | null;
  nextAttemptAt?: string | null;
  lastErrorCode?: string | null;
  legacy_tag?: 'legacy-v1';
};

function shortHash(seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/** Local UX fingerprint — not used as the server idempotency key. */
export function contributionFingerprintFor(input: {
  source_text: string;
  model_output: string;
  source_lang: 'en' | 'ne';
  formality: Formality | null | undefined;
  script: NepaliScript | null | undefined;
}): string {
  const seed = [
    input.source_lang,
    input.formality ?? 'unset',
    input.script ?? 'unset',
    input.source_text.trim(),
    input.model_output.trim(),
  ].join('|');
  return `fp_${shortHash(seed)}`;
}

/** @deprecated Use contributionFingerprintFor — kept for call-site migration. */
export const contributionKeyFor = contributionFingerprintFor;

export function newIdempotencyKey(): string {
  try {
    if (typeof Crypto.randomUUID === 'function') {
      return Crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  return `idemp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function asStatus(raw: unknown): OutboxStatus {
  if (raw === 'pending') return 'queued';
  if (raw === 'failed') return 'retry';
  if (
    raw === 'draft' ||
    raw === 'queued' ||
    raw === 'syncing' ||
    raw === 'retry' ||
    raw === 'synced' ||
    raw === 'rejected'
  ) {
    return raw;
  }
  return 'draft';
}

function asFormality(v: unknown): Formality | null {
  return v === 'formal' || v === 'informal' ? v : null;
}

function asScript(v: unknown): NepaliScript | null {
  return v === 'deva' || v === 'roman' ? v : null;
}

export function normalizeDraft(raw: unknown): ContributionDraft | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const source_text =
    typeof row.source_text === 'string' ? row.source_text : '';
  const model_output =
    typeof row.model_output === 'string' ? row.model_output : '';
  const source_lang =
    row.source_lang === 'en' || row.source_lang === 'ne'
      ? row.source_lang
      : null;
  if (!source_lang) return null;
  const formality = asFormality(row.formality);
  const script = asScript(row.script);
  const surface: OutboxSurface =
    row.surface === 'live_translate' ||
    row.surface === 'history' ||
    row.surface === 'legacy-v1'
      ? row.surface
      : 'history';
  const local_fingerprint =
    typeof row.local_fingerprint === 'string' && row.local_fingerprint
      ? row.local_fingerprint
      : contributionFingerprintFor({
          source_text,
          model_output,
          source_lang,
          formality,
          script,
        });
  const idempotency_key =
    typeof row.idempotency_key === 'string' && row.idempotency_key
      ? row.idempotency_key
      : newIdempotencyKey();
  const now = new Date().toISOString();
  return {
    id:
      typeof row.id === 'string' && row.id
        ? row.id
        : `draft_${shortHash(`${idempotency_key}|${now}`)}`,
    idempotency_key,
    local_fingerprint,
    surface,
    source_text,
    model_output,
    correction_text:
      typeof row.correction_text === 'string' ? row.correction_text : null,
    source_lang,
    formality,
    script,
    translation_method:
      typeof row.translation_method === 'string'
        ? row.translation_method
        : null,
    model_version:
      typeof row.model_version === 'string' ? row.model_version : null,
    consent_version:
      typeof row.consent_version === 'string' ? row.consent_version : null,
    status: asStatus(row.status),
    created_at:
      typeof row.created_at === 'string' ? row.created_at : now,
    updated_at:
      typeof row.updated_at === 'string' ? row.updated_at : now,
    attemptCount:
      typeof row.attemptCount === 'number' ? row.attemptCount : 0,
    lastAttemptAt:
      typeof row.lastAttemptAt === 'string' ? row.lastAttemptAt : null,
    nextAttemptAt:
      typeof row.nextAttemptAt === 'string' ? row.nextAttemptAt : null,
    lastErrorCode:
      typeof row.lastErrorCode === 'string' ? row.lastErrorCode : null,
    legacy_tag: row.legacy_tag === 'legacy-v1' ? 'legacy-v1' : undefined,
  };
}

/** Serialize all AsyncStorage outbox mutations through one chain. */
let mutationChain: Promise<unknown> = Promise.resolve();

export async function updateOutbox<T>(
  mutator: (items: ContributionDraft[]) => { items: ContributionDraft[]; result: T },
): Promise<T> {
  const run = mutationChain.then(async () => {
    let items: ContributionDraft[] = [];
    try {
      const raw = await AsyncStorage.getItem(OUTBOX_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          items = parsed
            .map((row) => normalizeDraft(row))
            .filter((d): d is ContributionDraft => d != null);
        }
      }
    } catch {
      items = [];
    }
    const { items: next, result } = mutator(items);
    await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(next));
    return result;
  });
  mutationChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function loadOutbox(): Promise<ContributionDraft[]> {
  return updateOutbox((items) => ({ items, result: items.slice() }));
}

export async function listDrafts(): Promise<ContributionDraft[]> {
  return loadOutbox();
}

export async function findDraftByKey(
  idempotencyKey: string,
): Promise<ContributionDraft | null> {
  const items = await loadOutbox();
  return items.find((d) => d.idempotency_key === idempotencyKey) ?? null;
}

export async function findDraftByFingerprint(
  fingerprint: string,
): Promise<ContributionDraft | null> {
  const items = await loadOutbox();
  return items.find((d) => d.local_fingerprint === fingerprint) ?? null;
}

export type EnqueueInput = {
  idempotency_key?: string;
  local_fingerprint: string;
  surface: OutboxSurface;
  source_text: string;
  model_output: string;
  correction_text: string | null;
  source_lang: 'en' | 'ne';
  formality: Formality | null;
  script: NepaliScript | null;
  translation_method?: string | null;
  model_version?: string | null;
  consent_version: string | null;
  status: OutboxStatus;
  legacy_tag?: 'legacy-v1';
  id?: string;
};

/**
 * Upsert by existing idempotency_key when provided and found; otherwise by
 * fingerprint among non-synced rows. Never auto-promotes draft → queued.
 */
export async function enqueueDraft(
  input: EnqueueInput,
): Promise<ContributionDraft> {
  return updateOutbox((items) => {
    const now = new Date().toISOString();
    const byKey = input.idempotency_key
      ? items.find((d) => d.idempotency_key === input.idempotency_key)
      : undefined;
    const byFp =
      byKey ??
      items.find(
        (d) =>
          d.local_fingerprint === input.local_fingerprint &&
          d.status !== 'synced',
      );
    if (byFp) {
      const next: ContributionDraft = {
        ...byFp,
        ...input,
        id: byFp.id,
        idempotency_key: byFp.idempotency_key,
        local_fingerprint: input.local_fingerprint,
        created_at: byFp.created_at,
        updated_at: now,
        // Never demote synced; never invent queued from draft here.
        status:
          byFp.status === 'synced'
            ? 'synced'
            : input.status === 'synced'
              ? 'synced'
              : input.status,
      };
      return {
        items: items.map((d) => (d.id === byFp.id ? next : d)),
        result: next,
      };
    }
    const draft: ContributionDraft = {
      ...input,
      id: input.id ?? `draft_${shortHash(`${input.local_fingerprint}|${now}`)}`,
      idempotency_key: input.idempotency_key ?? newIdempotencyKey(),
      attemptCount: 0,
      lastAttemptAt: null,
      nextAttemptAt: null,
      lastErrorCode: null,
      created_at: now,
      updated_at: now,
    };
    return {
      items: [draft, ...items].slice(0, 200),
      result: draft,
    };
  });
}

export async function updateDraftById(
  id: string,
  patch: Partial<ContributionDraft>,
): Promise<ContributionDraft | null> {
  return updateOutbox((items) => {
    const idx = items.findIndex((d) => d.id === id);
    if (idx < 0) return { items, result: null };
    const now = new Date().toISOString();
    const next: ContributionDraft = {
      ...items[idx],
      ...patch,
      id: items[idx].id,
      idempotency_key: items[idx].idempotency_key,
      created_at: items[idx].created_at,
      updated_at: now,
    };
    const copy = items.slice();
    copy[idx] = next;
    return { items: copy, result: next };
  });
}

export async function deleteDraft(id: string): Promise<void> {
  await updateOutbox((items) => ({
    items: items.filter((d) => d.id !== id),
    result: undefined,
  }));
}

export async function markSynced(idempotencyKey: string): Promise<void> {
  await updateOutbox((items) => ({
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

export async function markRejected(
  idempotencyKey: string,
  errorCode: string,
): Promise<void> {
  await updateOutbox((items) => ({
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

export async function markRetry(
  idempotencyKey: string,
  errorCode: string,
  nextAttemptAt: string,
): Promise<void> {
  await updateOutbox((items) => ({
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

export async function markSyncing(idempotencyKey: string): Promise<void> {
  await updateOutbox((items) => ({
    items: items.map((d) =>
      d.idempotency_key === idempotencyKey
        ? {
            ...d,
            status: 'syncing' as const,
            updated_at: new Date().toISOString(),
          }
        : d,
    ),
    result: undefined,
  }));
}

/** Explicit user submit only — never auto-promotes. */
export async function queueDraftForSubmit(
  idempotencyKey: string,
  consentVersion: string,
): Promise<ContributionDraft | null> {
  return updateOutbox((items) => {
    const idx = items.findIndex((d) => d.idempotency_key === idempotencyKey);
    if (idx < 0) return { items, result: null };
    const d = items[idx];
    if (d.status === 'synced') return { items, result: d };
    if (!d.formality || !d.script) return { items, result: d };
    const next: ContributionDraft = {
      ...d,
      consent_version: consentVersion,
      status: 'queued',
      lastErrorCode: null,
      nextAttemptAt: null,
      updated_at: new Date().toISOString(),
    };
    const copy = items.slice();
    copy[idx] = next;
    return { items: copy, result: next };
  });
}

export async function requeueForRetry(id: string): Promise<ContributionDraft | null> {
  return updateOutbox((items) => {
    const idx = items.findIndex((d) => d.id === id);
    if (idx < 0) return { items, result: null };
    const d = items[idx];
    if (d.status !== 'retry' && d.status !== 'rejected') {
      return { items, result: d };
    }
    const next: ContributionDraft = {
      ...d,
      status: 'queued',
      nextAttemptAt: null,
      lastErrorCode: null,
      updated_at: new Date().toISOString(),
    };
    const copy = items.slice();
    copy[idx] = next;
    return { items: copy, result: next };
  });
}

/** Drafts eligible to upload: queued, or retry past nextAttemptAt, or abandoned syncing. */
export async function pendingDrafts(
  nowMs: number = Date.now(),
): Promise<ContributionDraft[]> {
  const items = await loadOutbox();
  return items.filter((d) => {
    if (d.status === 'draft' || d.status === 'synced' || d.status === 'rejected') {
      return false;
    }
    if (d.status === 'queued' || d.status === 'syncing') return true;
    if (d.status === 'retry') {
      if (!d.nextAttemptAt) return true;
      return Date.parse(d.nextAttemptAt) <= nowMs;
    }
    return false;
  });
}

export type OutboxCounts = {
  draft: number;
  waitingToSync: number;
  pendingValidation: number;
  validated: number;
  rejected: number;
  needsAttention: number;
};

export function countOutbox(items: ContributionDraft[]): OutboxCounts {
  const counts: OutboxCounts = {
    draft: 0,
    waitingToSync: 0,
    pendingValidation: 0,
    validated: 0,
    rejected: 0,
    needsAttention: 0,
  };
  for (const d of items) {
    if (d.status === 'draft') counts.draft += 1;
    if (d.status === 'queued' || d.status === 'syncing' || d.status === 'retry') {
      counts.waitingToSync += 1;
    }
    if (d.status === 'synced') counts.pendingValidation += 1;
    if (d.status === 'rejected') counts.rejected += 1;
    if (d.status === 'retry' || d.status === 'rejected') {
      counts.needsAttention += 1;
    }
  }
  return counts;
}

/**
 * Exponential backoff capped at 15 minutes, with jitter.
 * attemptCount is the count *after* this failure is recorded (1-based).
 */
export function computeNextAttemptAt(
  attemptCount: number,
  nowMs: number = Date.now(),
  random: () => number = Math.random,
): string {
  const exp = Math.max(0, attemptCount - 1);
  const baseMs = Math.min(15 * 60 * 1000, 1000 * 2 ** exp);
  const jitter = Math.floor(random() * baseMs * 0.25);
  return new Date(nowMs + baseMs + jitter).toISOString();
}

/**
 * Move legacy PC review-sync queue into local drafts.
 * Never auto-uploads. Never invents formal+deva labels.
 */
export async function migrateLegacyReviewQueue(): Promise<number> {
  let raw: string | null = null;
  try {
    raw = await AsyncStorage.getItem(LEGACY_QUEUE_KEY);
  } catch {
    return 0;
  }
  if (!raw) return 0;
  let queue: Array<Record<string, unknown>> = [];
  try {
    const parsed = JSON.parse(raw);
    queue = Array.isArray(parsed) ? parsed : [];
  } catch {
    await AsyncStorage.removeItem(LEGACY_QUEUE_KEY);
    return 0;
  }
  let converted = 0;
  for (const item of queue) {
    const english = String(item.english ?? '').trim();
    const ne =
      String(item.ne_formal_final ?? item.ne_informal_final ?? '').trim() ||
      String(
        item.ne_formal_original ?? item.ne_informal_original ?? '',
      ).trim();
    if (!english && !ne) continue;
    const meaningId = String(item.meaning_id ?? shortHash(`${english}|${ne}`));
    const source_text = english || ne;
    const model_output =
      english && ne
        ? english === String(item.english ?? '')
          ? ne
          : english
        : '';
    const fingerprint = contributionFingerprintFor({
      source_text,
      model_output,
      source_lang: 'en',
      formality: null,
      script: null,
    });
    await enqueueDraft({
      idempotency_key: `legacy_${meaningId}`,
      local_fingerprint: fingerprint,
      surface: 'legacy-v1',
      legacy_tag: 'legacy-v1',
      source_text,
      model_output,
      correction_text: null,
      source_lang: 'en',
      formality: null,
      script: null,
      consent_version: null,
      status: 'draft',
    });
    converted += 1;
  }
  await AsyncStorage.removeItem(LEGACY_QUEUE_KEY);
  return converted;
}

/** Clear contribution outbox caches after completed account deletion. */
export async function clearContributionCaches(): Promise<void> {
  await AsyncStorage.multiRemove([OUTBOX_KEY, LEGACY_QUEUE_KEY]);
}
