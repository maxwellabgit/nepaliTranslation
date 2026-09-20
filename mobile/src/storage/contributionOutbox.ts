import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Formality, NepaliScript } from '../mt/onDeviceTranslate';

export const OUTBOX_KEY = 'neptranslate.contribution_outbox.v1';
export const LEGACY_QUEUE_KEY = 'neptranslate.review_sync.queue.v1';

export type OutboxSurface = 'live_translate' | 'history' | 'legacy-v1';
export type OutboxStatus = 'draft' | 'pending' | 'synced' | 'failed';

export type ContributionDraft = {
  id: string;
  idempotency_key: string;
  surface: OutboxSurface;
  source_text: string;
  model_output: string;
  correction_text: string | null;
  source_lang: 'en' | 'ne';
  formality: Formality;
  script: NepaliScript;
  consent_version: string | null;
  status: OutboxStatus;
  created_at: string;
  updated_at: string;
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

export function contributionKeyFor(input: {
  source_text: string;
  model_output: string;
  source_lang: 'en' | 'ne';
  formality: Formality;
  script: NepaliScript;
}): string {
  const seed = [
    input.source_lang,
    input.formality,
    input.script,
    input.source_text.trim(),
    input.model_output.trim(),
  ].join('|');
  return `corr_${shortHash(seed)}`;
}

export async function loadOutbox(): Promise<ContributionDraft[]> {
  try {
    const raw = await AsyncStorage.getItem(OUTBOX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ContributionDraft[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveOutbox(items: ContributionDraft[]): Promise<void> {
  await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(items));
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

/** Idempotent on idempotency_key. Does not auto-upload. */
export async function enqueueDraft(
  input: Omit<ContributionDraft, 'id' | 'created_at' | 'updated_at'> & {
    id?: string;
  },
): Promise<ContributionDraft> {
  const items = await loadOutbox();
  const now = new Date().toISOString();
  const existing = items.find((d) => d.idempotency_key === input.idempotency_key);
  if (existing) {
    const next: ContributionDraft = {
      ...existing,
      ...input,
      id: existing.id,
      created_at: existing.created_at,
      updated_at: now,
      status: existing.status === 'synced' ? 'synced' : input.status,
    };
    const updated = items.map((d) => (d.id === existing.id ? next : d));
    await saveOutbox(updated);
    return next;
  }
  const draft: ContributionDraft = {
    ...input,
    id: input.id ?? `draft_${shortHash(`${input.idempotency_key}|${now}`)}`,
    created_at: now,
    updated_at: now,
  };
  await saveOutbox([draft, ...items].slice(0, 200));
  return draft;
}

export async function markSynced(idempotencyKey: string): Promise<void> {
  const items = await loadOutbox();
  const now = new Date().toISOString();
  await saveOutbox(
    items.map((d) =>
      d.idempotency_key === idempotencyKey
        ? { ...d, status: 'synced', updated_at: now }
        : d,
    ),
  );
}

export async function markFailed(idempotencyKey: string): Promise<void> {
  const items = await loadOutbox();
  const now = new Date().toISOString();
  await saveOutbox(
    items.map((d) =>
      d.idempotency_key === idempotencyKey
        ? { ...d, status: 'failed', updated_at: now }
        : d,
    ),
  );
}

export async function pendingDrafts(): Promise<ContributionDraft[]> {
  const items = await loadOutbox();
  return items.filter((d) => d.status === 'pending');
}

/**
 * Move legacy PC review-sync queue into local drafts.
 * Never auto-uploads. Clears the old queue after conversion.
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
      String(item.ne_formal_original ?? item.ne_informal_original ?? '').trim();
    if (!english && !ne) continue;
    const meaningId = String(item.meaning_id ?? shortHash(`${english}|${ne}`));
    await enqueueDraft({
      idempotency_key: `legacy_${meaningId}`,
      surface: 'legacy-v1',
      legacy_tag: 'legacy-v1',
      source_text: english || ne,
      model_output: english && ne ? (english === String(item.english ?? '') ? ne : english) : '',
      correction_text: null,
      source_lang: 'en',
      formality: 'formal',
      script: 'deva',
      consent_version: null,
      status: 'draft',
    });
    converted += 1;
  }
  await AsyncStorage.removeItem(LEGACY_QUEUE_KEY);
  return converted;
}
