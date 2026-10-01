import AsyncStorage from '@react-native-async-storage/async-storage';
import { copyToMediaOutboxDir, enqueueEligibleSpeechRecording } from '../../services/mediaEnqueue';

/** Spoken clips longer than this are discarded. */
export const MAX_UTTERANCE_MS = 60_000;

/** Keep several recordings on the device while offline or while upload is slow. */
export const LOCAL_UTTERANCE_KEEP = 4;

const KEY = 'neptranslate.utterances.v1';

export type UtteranceFeedback = 'up' | 'down';

export type StoredUtterance = {
  id: string;
  transcript: string;
  audioUri: string;
  feedback: UtteranceFeedback;
  durationMs: number;
  language: 'en' | 'ne';
  createdAt: string;
  /** True once the speech outbox has accepted the file. */
  handedOff: boolean;
};

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

/**
 * Save a rated utterance on the device, then hand it to the speech uploader
 * when the account is allowed to send. The local copy stays until that handoff.
 */
export async function saveUtterance(
  input: {
    transcript: string;
    audioUri: string;
    feedback: UtteranceFeedback;
    durationMs: number;
    language: 'en' | 'ne';
    signedIn?: boolean;
    authConfigured?: boolean;
    userId?: string | null;
  },
  deps: SaveDeps = {},
): Promise<{ ok: true; item: StoredUtterance } | { ok: false; reason: 'too_long' | 'invalid' }> {
  const transcript = input.transcript.trim();
  if (!transcript || !input.audioUri) return { ok: false, reason: 'invalid' };
  if (!utteranceAllowed(input.durationMs)) return { ok: false, reason: 'too_long' };
  const copy = deps.copy ?? copyToMediaOutboxDir;
  const copied = await copy(input.audioUri, 'speech', 'audio/mp4');
  if (!copied) return { ok: false, reason: 'invalid' };
  const item: StoredUtterance = {
    id: `utt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    transcript,
    audioUri: copied.uri,
    feedback: input.feedback,
    durationMs: input.durationMs,
    language: input.language,
    createdAt: new Date().toISOString(),
    handedOff: false,
  };
  const items = await readAll();
  items.push(item);
  await writeAll(items);
  await tryUploadPendingUtterances(
    {
      signedIn: Boolean(input.signedIn),
      authConfigured: Boolean(input.authConfigured),
      userId: input.userId ?? null,
    },
    deps.upload,
  );
  const saved = (await readAll()).find((row) => row.id === item.id) ?? item;
  return { ok: true, item: saved };
}

export async function readPendingUtterances(): Promise<StoredUtterance[]> {
  return (await readAll()).filter((item) => !item.handedOff);
}

/** Move on-device utterances into the speech outbox when upload is allowed. */
export async function tryUploadPendingUtterances(
  account: { signedIn: boolean; authConfigured: boolean; userId: string | null },
  upload: typeof enqueueEligibleSpeechRecording = enqueueEligibleSpeechRecording,
): Promise<number> {
  const items = await readAll();
  let handed = 0;
  for (const item of items) {
    if (item.handedOff) continue;
    const queued = await upload({
      sourceUri: item.audioUri,
      signedIn: account.signedIn,
      authConfigured: account.authConfigured,
      userId: account.userId,
      contentType: 'audio/mp4',
      metadata: {
        transcript: item.transcript,
        feedback: item.feedback,
        duration_ms: item.durationMs,
        language: item.language,
        surface: 'translate_mic',
      },
    });
    if (!queued) continue;
    item.handedOff = true;
    handed += 1;
  }
  await writeAll(items);
  return handed;
}
