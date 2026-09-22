import { enqueueMediaItem, type MediaOutboxItem } from '../../storage/mediaOutbox';
import { getRuntimeFeatureFlags } from '../../app/featureFlags';
import { canUploadContributionMedia } from '../auth/consent';
import { loadLocalConsent } from '../../storage/contributionConsent';
import { loadStartupConsent, isStartupConsentCurrent } from '../../storage/startupConsent';

/**
 * G2 speech-media contribution helper.
 *
 * The raw speech-media upload path is in V1 scope. Uploads only run when:
 *   * the user has completed the startup consent gate (T&C + Privacy + 18+),
 *   * they are signed in,
 *   * their media consent is current for the app-config version,
 *   * and `contribution_speech_enabled` is true.
 *
 * The caller supplies a **durable** local file URI (already copied out of
 * whatever tmp location STT/recorder emits). See `STT capture URI` blocker
 * in `plans/active/v1-testflight-finalization.md` — recording pipe wiring
 * lands with device work.
 */
export async function enqueueSpeechContribution(input: {
  signedIn: boolean;
  authConfigured: boolean;
  localUri: string;
  contentType: string;
  byteSize: number;
  metadata?: Record<string, unknown>;
}): Promise<
  | { ok: true; item: MediaOutboxItem }
  | {
      ok: false;
      reason:
        | 'unavailable'
        | 'sign_in'
        | 'guest'
        | 'consent'
        | 'age'
        | 'flag_off'
        | 'startup_gate'
        | 'invalid';
    }
> {
  if (!input.localUri || input.byteSize <= 0) {
    return { ok: false, reason: 'invalid' };
  }
  const startup = await loadStartupConsent();
  if (!isStartupConsentCurrent(startup)) {
    return { ok: false, reason: 'startup_gate' };
  }
  const consent = await loadLocalConsent();
  const flags = getRuntimeFeatureFlags();
  const gate = canUploadContributionMedia({
    authConfigured: input.authConfigured,
    signedIn: input.signedIn,
    consentVersion: consent?.consent_version ?? null,
    ageConfirmed: Boolean(consent?.age_confirmed),
    kind: 'speech',
    speechEnabled: flags.contributionSpeechEnabled === true,
    photosEnabled: flags.contributionPhotosEnabled === true,
  });
  if (!gate.ok) return gate;

  const item = await enqueueMediaItem({
    kind: 'speech',
    local_uri: input.localUri,
    content_type: input.contentType,
    byte_size: input.byteSize,
    consent_version: consent?.consent_version ?? '',
    metadata: input.metadata,
  });
  return { ok: true, item };
}
