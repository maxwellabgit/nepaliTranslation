import { Directory, File, Paths } from 'expo-file-system';
import {
  canUploadContributionMedia,
  CONTRIBUTION_CONSENT_VERSION,
  type MediaKind,
} from '../features/auth/consent';
import { getRuntimeFeatureFlags } from '../app/featureFlags';
import { loadLocalConsent } from '../storage/contributionConsent';
import {
  enqueueMediaItem,
  newMediaIdempotencyKey,
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
  contentType?: string;
  metadata?: Record<string, unknown>;
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
    const flags = getRuntimeFeatureFlags();
    const consent = await loadLocalConsent();
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

    const contentType =
      input.contentType ?? contentTypeForUri(input.sourceUri, input.kind);
    const copied = await copyToMediaOutboxDir(
      input.sourceUri,
      input.kind,
      contentType,
    );
    if (!copied) return null;

    return enqueueMediaItem({
      idempotency_key: newMediaIdempotencyKey(),
      kind: input.kind,
      local_uri: copied.uri,
      content_type: contentType,
      byte_size: copied.byteSize,
      consent_version: CONTRIBUTION_CONSENT_VERSION,
      metadata: {
        ...input.metadata,
        source: input.kind === 'photo' ? 'camera' : 'speech',
      },
    });
  } catch {
    return null;
  }
}

/**
 * Speech auto-upload requires a durable local recording URI.
 * On-device STT (expo-speech-recognition) does not currently produce one —
 * call this only when a recording file exists. See ExecPlan F3 blocker.
 */
export async function enqueueEligibleSpeechRecording(
  input: Omit<EnqueueEligibleMediaInput, 'kind'>,
): Promise<MediaOutboxItem | null> {
  return enqueueEligibleMedia({ ...input, kind: 'speech' });
}
