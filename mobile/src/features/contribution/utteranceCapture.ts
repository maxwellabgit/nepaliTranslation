import { sessionInactiveNow } from '../auth/sessionExpiry';
import { hasPendingDeletion } from '../../storage/pendingDeletion';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  copyToMediaOutboxDir,
  deleteDurableMediaFile,
  deliverSpeechFeedback,
  enqueueEligibleSpeechRecording,
} from '../../services/mediaEnqueue';
import { loadMediaOutbox, mergeMediaFeedback } from '../../storage/mediaOutbox';

/** Spoken clips longer than this are discarded. The recording layer stops at this limit. */
export const MAX_UTTERANCE_MS = 60_000;

/** After the server acknowledges a clip, keep this many recent local copies per account. */
export const LOCAL_UTTERANCE_KEEP = 4;

/** Unsent clips stop at this count or PENDING_BYTE_CAP, whichever comes first. */
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
  /** Last revision known to match the server. Older than feedbackRevision means a rating is still pending. */
  feedbackAckRevision: number;
  durationMs: number;
  byteSize: number;
  language: 'en' | 'ne';
  createdAt: string;
  ownerId: string | null;
  /** Guest or non-consented audio never joins a later account upload. */
  localOnly: boolean;
  /** True once the speech outbox has accepted the file. This is not a server receipt. */
  handedOff: boolean;
  /** True only after the server has the audio object. */
  serverAcked: boolean;
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

export function utteranceIdempotencyKey(ownerId: string, utteranceId: string): string {
  return `utt:${ownerId}:${utteranceId}`;
}

let chain: Promise<unknown> = Promise.resolve();

function mutate<T>(task: () => Promise<T>): Promise<T> {
  const run = chain.then(task, task);
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function readAll(): Promise<StoredUtterance[]> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as StoredUtterance[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => ({
      ...item,
      feedbackAckRevision:
        typeof item.feedbackAckRevision === 'number' ? item.feedbackAckRevision : 0,
      serverAcked: item.serverAcked === true,
      handedOff: item.handedOff === true,
    }));
  } catch {
    return [];
  }
}

async function writeAll(items: StoredUtterance[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
}

/** A synced outbox row is the server receipt, including clips queued before that flag existed. */
async function reconcileServerAcks(
  items: StoredUtterance[],
  deleteFile: (uri: string) => void,
): Promise<StoredUtterance[]> {
  const needsReconcile = items.some(
    (item) => item.handedOff && item.serverAcked !== true && item.ownerId,
  );
  if (!needsReconcile) return items;
  const outbox = await loadMediaOutbox();
  const synced = new Set(
    outbox.filter((row) => row.status === 'synced').map((row) => row.idempotency_key),
  );
  let changed = false;
  for (const item of items) {
    if (!item.ownerId || item.serverAcked || !item.handedOff) continue;
    const ownerId = item.ownerId;
    if (!synced.has(utteranceIdempotencyKey(ownerId, item.id))) continue;
    item.serverAcked = true;
    if (item.feedbackAckRevision < item.feedbackRevision) {
      const row = outbox.find(
        (entry) => entry.idempotency_key === utteranceIdempotencyKey(ownerId, item.id),
      );
      const sent = typeof row?.metadata.feedbackRevision === 'number' ? row.metadata.feedbackRevision : 0;
      if (item.feedbackRevision <= sent) item.feedbackAckRevision = item.feedbackRevision;
    }
    changed = true;
  }
  if (!changed) return items;
  const pruned = pruneAcked(items);
  await writeAll(pruned.kept);
  for (const uri of pruned.dropUris) deleteFile(uri);
  return pruned.kept;
}

type SpeechUpload = (
  input: Parameters<typeof enqueueEligibleSpeechRecording>[0],
) => Promise<unknown>;

type SaveDeps = {
  copy?: typeof copyToMediaOutboxDir;
  upload?: SpeechUpload;
  deleteFile?: (uri: string) => void;
};

function unsent(items: StoredUtterance[]): StoredUtterance[] {
  return items.filter((item) => item.serverAcked !== true);
}

function unsentBytes(items: StoredUtterance[]): number {
  return unsent(items).reduce((total, item) => total + (item.byteSize > 0 ? item.byteSize : 1), 0);
}

function pruneAcked(items: StoredUtterance[]): { kept: StoredUtterance[]; dropUris: string[] } {
  const drop = new Set<string>();
  const owners = new Set(items.map((item) => item.ownerId ?? ''));
  for (const owner of owners) {
    const acked = items
      .filter((item) => (item.ownerId ?? '') === owner && item.serverAcked === true)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
    for (const item of acked.slice(LOCAL_UTTERANCE_KEEP)) drop.add(item.id);
  }
  return {
    kept: items.filter((item) => !drop.has(item.id)),
    dropUris: items.filter((item) => drop.has(item.id)).map((item) => item.audioUri),
  };
}

/**
 * Save one utterance on the device, then hand an eligible owned file to the
 * speech outbox once. A full unsent queue reports not_saved and leaves
 * existing clips in place. Queued and uploaded are different states.
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
  const deleteFile = deps.deleteFile ?? deleteDurableMediaFile;
  const saved = await mutate(async () => {
    const existing = await reconcileServerAcks(await readAll(), deleteFile);
    const id = input.id ?? newUtteranceId();
    const current = existing.find((item) => item.id === id);
    if (current) return { ok: true as const, item: current, shouldUpload: false };
    const waiting = unsent(existing);
    if (waiting.length >= PENDING_UTTERANCE_CAP) {
      return { ok: false as const, reason: 'not_saved' as const };
    }
    const copy = deps.copy ?? copyToMediaOutboxDir;
    const copied = await copy(input.audioUri, 'speech', 'audio/mp4');
    if (!copied) return { ok: false as const, reason: 'invalid' as const };
    if (unsentBytes(existing) + copied.byteSize > PENDING_BYTE_CAP) {
      deleteFile(copied.uri);
      return { ok: false as const, reason: 'not_saved' as const };
    }
    const ownerId = input.userId ?? null;
    const localOnly = !ownerId || input.eligible === false || (await hasPendingDeletion(ownerId) || await sessionInactiveNow(ownerId));
    const item: StoredUtterance = {
      id,
      transcript,
      audioUri: copied.uri,
      feedback: input.feedback ?? 'unrated',
      feedbackRevision: 1,
      feedbackAckRevision: 0,
      durationMs: input.durationMs,
      byteSize: copied.byteSize,
      language: input.language,
      createdAt: input.capturedAt ?? new Date().toISOString(),
      ownerId,
      localOnly,
      handedOff: false,
      serverAcked: false,
    };
    try {
      await writeAll([...existing, item]);
    } catch {
      deleteFile(copied.uri);
      return { ok: false as const, reason: 'not_saved' as const };
    }
    return { ok: true as const, item, shouldUpload: !localOnly };
  });
  if (!saved.ok || !saved.shouldUpload) {
    return saved.ok ? { ok: true, item: saved.item } : saved;
  }
  await tryUploadPendingUtterances(
    {
      signedIn: Boolean(input.signedIn),
      authConfigured: Boolean(input.authConfigured),
      userId: saved.item.ownerId,
    },
    deps.upload,
  );
  const fresh = await mutate(async () => (await readAll()).find((row) => row.id === saved.item.id));
  return { ok: true, item: fresh ?? saved.item };
}

export async function updateUtteranceFeedback(
  id: string,
  feedback: Exclude<UtteranceFeedback, 'unrated'>,
  upload: SpeechUpload = enqueueEligibleSpeechRecording,
): Promise<StoredUtterance | null> {
  const item = await mutate(async () => {
    const items = await readAll();
    const row = items.find((entry) => entry.id === id);
    if (!row) return null;
    if (row.feedback !== feedback) {
      row.feedback = feedback;
      row.feedbackRevision += 1;
      await writeAll(items);
    }
    return { ...row };
  });
  if (!item || !item.ownerId || item.localOnly || (await hasPendingDeletion(item.ownerId) || await sessionInactiveNow(item.ownerId))) return item;
  const metadata = metadataFor(item);
  const key = utteranceIdempotencyKey(item.ownerId, item.id);
  const merged = await mergeMediaFeedback(key, metadata);
  if (!merged) {
    const queued = await upload({
      sourceUri: item.audioUri,
      signedIn: true,
      authConfigured: true,
      userId: item.ownerId,
      contentType: 'audio/mp4',
      alreadyDurable: true,
      byteSize: item.byteSize,
      idempotencyKey: key,
      metadata,
    });
    if (queued) {
      await mutate(async () => {
        const items = await readAll();
        const row = items.find((entry) => entry.id === id);
        if (!row) return;
        row.handedOff = true;
        await writeAll(items);
      });
    }
  }
  const delivered = await deliverSpeechFeedback(key, metadata);
  if (delivered) {
    await mutate(async () => {
      const items = await readAll();
      const row = items.find((entry) => entry.id === id);
      if (!row || row.feedbackRevision !== item.feedbackRevision) return;
      row.feedbackAckRevision = item.feedbackRevision;
      await writeAll(items);
    });
  }
  return item;
}

/** Withdrawal drops this account's clips and deletes their durable files. */
export async function discardUtterancesForOwner(
  ownerId: string,
  deleteFile: (uri: string) => void = deleteDurableMediaFile,
): Promise<string[]> {
  if (!ownerId) return [];
  const dropped = await mutate(async () => {
    const items = await readAll();
    const uris = items.filter((item) => item.ownerId === ownerId).map((item) => item.audioUri);
    await writeAll(items.filter((item) => item.ownerId !== ownerId));
    return uris;
  });
  for (const uri of dropped) deleteFile(uri);
  return dropped;
}

export async function readPendingUtterances(): Promise<StoredUtterance[]> {
  return mutate(async () =>
    unsent(await reconcileServerAcks(await readAll(), deleteDurableMediaFile)),
  );
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
  upload: SpeechUpload = enqueueEligibleSpeechRecording,
): Promise<number> {
  if (!account.userId || await hasPendingDeletion(account.userId)) return 0;
  const pendingIds = await mutate(async () =>
    (await reconcileServerAcks(await readAll(), deleteDurableMediaFile))
      .filter(
        (item) =>
          !item.handedOff &&
          !item.localOnly &&
          !item.serverAcked &&
          item.ownerId != null &&
          item.ownerId === account.userId,
      )
      .map((item) => item.id),
  );
  let handed = 0;
  for (const id of pendingIds) {
    const item = await mutate(async () => (await readAll()).find((row) => row.id === id) ?? null);
    if (!item || item.handedOff || item.localOnly || item.serverAcked) continue;
    if (!item.ownerId || item.ownerId !== account.userId || (await hasPendingDeletion(item.ownerId) || await sessionInactiveNow(item.ownerId))) continue;
    const queued = await upload({
      sourceUri: item.audioUri,
      signedIn: account.signedIn,
      authConfigured: account.authConfigured,
      userId: account.userId,
      contentType: 'audio/mp4',
      alreadyDurable: true,
      byteSize: item.byteSize,
      idempotencyKey: utteranceIdempotencyKey(item.ownerId, item.id),
      metadata: metadataFor(item),
    });
    if (!queued) continue;
    await mutate(async () => {
      const items = await readAll();
      const row = items.find((entry) => entry.id === id);
      if (!row || row.handedOff) return;
      row.handedOff = true;
      await writeAll(items);
    });
    handed += 1;
  }
  return handed;
}

/** The server has the audio. Keep a short local set and delete older acknowledged files. */
export async function markUtteranceServerAck(
  utteranceId: string,
  sentFeedbackRevision: number,
  deleteFile: (uri: string) => void = deleteDurableMediaFile,
): Promise<void> {
  const dropped = await mutate(async () => {
    const items = await readAll();
    const row = items.find((item) => item.id === utteranceId);
    if (row) {
      row.serverAcked = true;
      row.handedOff = true;
      if (row.feedbackRevision <= sentFeedbackRevision) {
        row.feedbackAckRevision = row.feedbackRevision;
      }
    }
    const pruned = pruneAcked(items);
    await writeAll(pruned.kept);
    return pruned.dropUris;
  });
  for (const uri of dropped) deleteFile(uri);
}
