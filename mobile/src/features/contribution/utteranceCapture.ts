import AsyncStorage from '@react-native-async-storage/async-storage';
import { copyToMediaOutboxDir, enqueueEligibleSpeechRecording } from '../../services/mediaEnqueue';

/** Spoken clips longer than this are discarded. The recording layer stops at this limit. */
export const MAX_UTTERANCE_MS = 60_000;

/** Keep several recordings on the device while offline or while upload is slow. */
export const LOCAL_UTTERANCE_KEEP = 4;

/** Pending clips stop at this count or PENDING_BYTE_CAP, whichever comes first. */
export const PENDING_UTTERANCE_CAP = 20;

export const PENDING_BYTE_CAP = 32 * 1024 * 1024;

const KEY = 'neptranslate.utterances.v1';

export type UtteranceFeedback = 'unrated' | 'up' | 'down';

export type StoredUtterance = {
  id: string;
  transcript: string;
  audioUri: string;
  feedback: UtteranceFeedback;
  feedbackRevision: number;
  durationMs: number;
  byteSize: number;
  language: 'en' | 'ne';
  createdAt: string;
  ownerId: string | null;
  /** Guest or non-consented audio never joins a later account upload. */
  localOnly: boolean;
  /** True once the speech outbox has accepted the file. */
  handedOff: boolean;
};

export type UtteranceMetadata = {
  schemaVersion: 1;
  utteranceId: string;
  transcript: string;
  language: 'en' | 'ne';
  feedback: UtteranceFeedback;
  feedbackRevision: number;
  capturedAt: string;
  durationMs: number;
  surface: 'translate_mic';
};

export function newUtteranceId(): string {
  return `utt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function utteranceAllowed(durationMs: number): boolean {
  return Number.isFinite(durationMs) && durationMs > 0 && durationMs <= MAX_UTTERANCE_MS;
}

async function readAll(): Promise<StoredUtterance[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as StoredUtterance[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAll(items: StoredUtterance[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
}

type SaveDeps = {
  copy?: typeof copyToMediaOutboxDir;
  upload?: typeof enqueueEligibleSpeechRecording;
};

function pendingBytes(items: StoredUtterance[]): number {
  return items
    .filter((item) => !item.handedOff)
    .reduce((total, item) => total + (item.byteSize > 0 ? item.byteSize : 1), 0);
}

/**
 * Save one utterance on the device, then hand an eligible owned file to the
 * speech outbox once. A full pending queue reports not_saved and leaves
 * existing clips in place.
 */
export async function saveUtterance(
  input: {
    id?: string;
    transcript: string;
    audioUri: string;
    feedback?: UtteranceFeedback;
    durationMs: number;
    language: 'en' | 'ne';
    signedIn?: boolean;
    authConfigured?: boolean;
    userId?: string | null;
    eligible?: boolean;
    capturedAt?: string;
  },
  deps: SaveDeps = {},
): Promise<
  | { ok: true; item: StoredUtterance }
  | { ok: false; reason: 'too_long' | 'invalid' | 'not_saved' }
> {
  const transcript = input.transcript.trim();
  if (!transcript || !input.audioUri) return { ok: false, reason: 'invalid' };
  if (!utteranceAllowed(input.durationMs)) return { ok: false, reason: 'too_long' };
  const existing = await readAll();
  const id = input.id ?? newUtteranceId();
  if (existing.some((item) => item.id === id)) {
    const current = existing.find((item) => item.id === id);
    return current ? { ok: true, item: current } : { ok: false, reason: 'invalid' };
  }
  const pending = existing.filter((item) => !item.handedOff);
  if (pending.length >= PENDING_UTTERANCE_CAP) return { ok: false, reason: 'not_saved' };
  const copy = deps.copy ?? copyToMediaOutboxDir;
  const copied = await copy(input.audioUri, 'speech', 'audio/mp4');
  if (!copied) return { ok: false, reason: 'invalid' };
  if (pendingBytes(existing) + copied.byteSize > PENDING_BYTE_CAP) {
    return { ok: false, reason: 'not_saved' };
  }
  const ownerId = input.userId ?? null;
  const localOnly = !ownerId || input.eligible === false;
  const item: StoredUtterance = {
    id,
    transcript,
    audioUri: copied.uri,
    feedback: input.feedback ?? 'unrated',
    feedbackRevision: 1,
    durationMs: input.durationMs,
    byteSize: copied.byteSize,
    language: input.language,
    createdAt: input.capturedAt ?? new Date().toISOString(),
    ownerId,
    localOnly,
    handedOff: false,
  };
  existing.push(item);
  await writeAll(existing);
  if (!localOnly) {
    await tryUploadPendingUtterances(
      {
        signedIn: Boolean(input.signedIn),
        authConfigured: Boolean(input.authConfigured),
        userId: ownerId,
      },
      deps.upload,
    );
  }
  const saved = (await readAll()).find((row) => row.id === item.id) ?? item;
  return { ok: true, item: saved };
}

export async function updateUtteranceFeedback(
  id: string,
  feedback: Exclude<UtteranceFeedback, 'unrated'>,
  upload: typeof enqueueEligibleSpeechRecording = enqueueEligibleSpeechRecording,
): Promise<StoredUtterance | null> {
  const items = await readAll();
  const item = items.find((row) => row.id === id);
  if (!item) return null;
  if (item.feedback !== feedback) {
    item.feedback = feedback;
    item.feedbackRevision += 1;
    await writeAll(items);
  }
  if (item.handedOff && item.ownerId && !item.localOnly) {
    await upload({
      sourceUri: item.audioUri,
      signedIn: true,
      authConfigured: true,
      userId: item.ownerId,
      contentType: 'audio/mp4',
      alreadyDurable: true,
      byteSize: item.byteSize,
      idempotencyKey: `utt:${item.ownerId}:${item.id}`,
      metadata: metadataFor(item),
    });
  }
  return item;
}

/** Withdrawal drops this account's clips and does not assign them to anyone else. */
export async function discardUtterancesForOwner(ownerId: string): Promise<string[]> {
  if (!ownerId) return [];
  const items = await readAll();
  const dropped = items.filter((item) => item.ownerId === ownerId).map((item) => item.audioUri);
  await writeAll(items.filter((item) => item.ownerId !== ownerId));
  return dropped;
}

export async function readPendingUtterances(): Promise<StoredUtterance[]> {
  return (await readAll()).filter((item) => !item.handedOff);
}

function metadataFor(item: StoredUtterance): UtteranceMetadata & Record<string, unknown> {
  return {
    schemaVersion: 1,
    utteranceId: item.id,
    transcript: item.transcript,
    language: item.language,
    feedback: item.feedback,
    feedbackRevision: item.feedbackRevision,
    capturedAt: item.createdAt,
    durationMs: item.durationMs,
    surface: 'translate_mic',
  };
}

/** Move owned, consent-eligible utterances into the speech outbox. One copy, one id. */
export async function tryUploadPendingUtterances(
  account: { signedIn: boolean; authConfigured: boolean; userId: string | null },
  upload: typeof enqueueEligibleSpeechRecording = enqueueEligibleSpeechRecording,
): Promise<number> {
  const items = await readAll();
  let handed = 0;
  for (const item of items) {
    if (item.handedOff || item.localOnly) continue;
    if (!item.ownerId || item.ownerId !== account.userId) continue;
    const queued = await upload({
      sourceUri: item.audioUri,
      signedIn: account.signedIn,
      authConfigured: account.authConfigured,
      userId: account.userId,
      contentType: 'audio/mp4',
      alreadyDurable: true,
      byteSize: item.byteSize,
      idempotencyKey: `utt:${item.ownerId}:${item.id}`,
      metadata: metadataFor(item),
    });
    if (!queued) continue;
    item.handedOff = true;
    handed += 1;
  }
  await writeAll(items);
  return handed;
}
