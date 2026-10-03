import { sessionInactiveNow } from '../features/auth/sessionExpiry';
import { hasPendingDeletion } from '../storage/pendingDeletion';
import { Directory, File, Paths } from 'expo-file-system';
import {
  canUploadContributionMedia,
  CONTRIBUTION_CONSENT_VERSION,
  type MediaKind,
} from '../features/auth/consent';
import { getRuntimeFeatureFlags } from '../app/featureFlags';
import { loadLocalConsent } from '../storage/contributionConsent';
import { loadSharingToggles } from '../storage/sharingToggles';
import { getSupabase } from './supabase';
import {
  bumpCancelGeneration,
  cancelPendingKind,
  clearMediaFeedbackPending,
  enqueueMediaItem,
  feedbackRevisionOf,
  newMediaIdempotencyKey,
  readCancelGeneration,
  removeMediaForOwner,
  type MediaOutboxItem,
} from '../storage/mediaOutbox';

function contentTypeForUri(uri: string, kind: MediaKind): string {
  const lower = uri.toLowerCase();
  if (kind === 'photo') {
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.heic')) return 'image/heic';
    if (lower.endsWith('.heif')) return 'image/heif';
    return 'image/jpeg';
  }
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.m4a')) return 'audio/mp4';
  if (lower.endsWith('.aac')) return 'audio/aac';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.webm')) return 'audio/webm';
  return 'audio/mp4';
}

function extensionForContentType(contentType: string, kind: MediaKind): string {
  if (contentType.includes('png')) return 'png';
  if (contentType.includes('heic')) return 'heic';
  if (contentType.includes('heif')) return 'heif';
  if (contentType.includes('wav')) return 'wav';
  if (contentType.includes('aac')) return 'aac';
  if (contentType.includes('mpeg') || contentType.includes('mp3')) return 'mp3';
  if (contentType.includes('webm')) return 'webm';
  return kind === 'photo' ? 'jpg' : 'm4a';
}

/**
 * Copy a temporary capture/recording into a durable outbox directory.
 * Fail soft — never throw into Camera/Translate.
 */
export async function copyToMediaOutboxDir(
  sourceUri: string,
  kind: MediaKind,
  contentType: string,
): Promise<{ uri: string; byteSize: number } | null> {
  try {
    const dir = new Directory(Paths.document, 'contribution-media');
    if (!dir.exists) {
      dir.create();
    }
    const ext = extensionForContentType(contentType, kind);
    const dest = new File(dir, `${kind}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`);
    const source = new File(sourceUri);
    if (!source.exists) return null;
    source.copy(dest);
    const byteSize = typeof dest.size === 'number' && dest.size > 0 ? dest.size : 1;
    return { uri: dest.uri, byteSize };
  } catch {
    return null;
  }
}

export type EnqueueEligibleMediaInput = {
  kind: MediaKind;
  sourceUri: string;
  signedIn: boolean;
  authConfigured: boolean;
  userId?: string | null;
  contentType?: string;
  metadata?: Record<string, unknown>;
  /** The file is already the durable outbox copy. Do not copy it again. */
  alreadyDurable?: boolean;
  byteSize?: number;
  idempotencyKey?: string;
};

/**
 * If the user is a consented 18+ adult and the per-kind flag is on,
 * durable-copy and enqueue for background upload. Guests / flag-off → null.
 * Never throws; callers must still delete temporary Camera files.
 */
export async function enqueueEligibleMedia(
  input: EnqueueEligibleMediaInput,
): Promise<MediaOutboxItem | null> {
  try {
    if (!input.userId || (await hasPendingDeletion(input.userId) || await sessionInactiveNow(input.userId))) return null;
    const flags = getRuntimeFeatureFlags();
    const consent = await loadLocalConsent(input.userId);
    const gate = canUploadContributionMedia({
      authConfigured: input.authConfigured,
      signedIn: input.signedIn,
      consentVersion: consent?.consent_version ?? null,
      ageConfirmed: Boolean(consent?.age_confirmed),
      kind: input.kind,
      speechEnabled: flags.contributionSpeechEnabled,
      photosEnabled: flags.contributionPhotosEnabled,
    });
    if (!gate.ok) return null;
    if (input.kind === 'photo') return null;
    if (!input.userId) return null;
    const sharing = await loadSharingToggles(input.userId);
    if (!sharing.speech) return null;

    const contentType = input.contentType ?? contentTypeForUri(input.sourceUri, 'speech');
    const copied = input.alreadyDurable
      ? { uri: input.sourceUri, byteSize: input.byteSize && input.byteSize > 0 ? input.byteSize : 1 }
      : await copyToMediaOutboxDir(input.sourceUri, 'speech', contentType);
    if (!copied) return null;

    if ((await hasPendingDeletion(input.userId) || await sessionInactiveNow(input.userId))) {
      if (!input.alreadyDurable) deleteDurableMediaFile(copied.uri);
      return null;
    }
    const generation = await readCancelGeneration(input.userId);
    const queued = await enqueueMediaItem({
      idempotency_key: input.idempotencyKey ?? newMediaIdempotencyKey(),
      kind: 'speech',
      local_uri: copied.uri,
      content_type: contentType,
      byte_size: copied.byteSize,
      consent_version: CONTRIBUTION_CONSENT_VERSION,
      owner_id: input.userId,
      consent_epoch: CONTRIBUTION_CONSENT_VERSION,
      cancellation_generation: generation,
      metadata: {
        ...input.metadata,
        source: 'speech',
      },
    });
    if (!queued && !input.alreadyDurable) deleteDurableMediaFile(copied.uri);
    return queued;
  } catch {
    return null;
  }
}

/**
 * Speech auto-upload requires a durable local recording URI.
 * On-device STT (expo-speech-recognition) does not currently produce one —
 * call this only when a recording file exists. See ExecPlan F3 blocker.
 */
export function deleteDurableMediaFile(uri: string): void {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    /* a missing file must not block consent withdrawal */
  }
}

/**
 * Send the latest rating for one speech object. A missing server row stays pending.
 * This does not upload another audio file.
 */
export async function deliverSpeechFeedback(
  idempotencyKey: string,
  metadata: Record<string, unknown>,
): Promise<boolean> {
  const client = getSupabase();
  if (!client || typeof client.rpc !== 'function') return false;
  try {
    const session = (await client.auth.getSession()).data.session;
    const owner = session?.user?.id;
    if (!owner || !session?.access_token || (await hasPendingDeletion(owner) || await sessionInactiveNow(owner))) return false;
    const consent = await loadLocalConsent(owner);
    if (consent?.consent_version !== CONTRIBUTION_CONSENT_VERSION || !consent.age_confirmed) return false;
    const rpc = client.rpc.bind(client) as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ error: unknown }>;
    const { error } = await rpc('revise_media_feedback', {
      p_idempotency_key: idempotencyKey,
      p_metadata: metadata,
    });
    if (error) return false;
    await clearMediaFeedbackPending(idempotencyKey, feedbackRevisionOf(metadata));
    return true;
  } catch {
    return false;
  }
}

/** Withdrawal and account deletion drop that account's pending contribution files. */
export async function discardOwnerContributionFiles(ownerId: string): Promise<void> {
  if (!ownerId) return;
  await bumpCancelGeneration(ownerId);
  const uris = await removeMediaForOwner(ownerId);
  for (const uri of uris) deleteDurableMediaFile(uri);
}

/** Toggle-off cancels pending rows of that kind so they cannot transfer later. */
export async function stopPendingSharingKind(
  ownerId: string,
  kind: MediaKind,
): Promise<void> {
  if (!ownerId) return;
  const uris = await cancelPendingKind(ownerId, kind);
  for (const uri of uris) deleteDurableMediaFile(uri);
}

export async function enqueueEligibleSpeechRecording(
  input: Omit<EnqueueEligibleMediaInput, 'kind'>,
): Promise<MediaOutboxItem | null> {
  return enqueueEligibleMedia({ ...input, kind: 'speech' });
}
