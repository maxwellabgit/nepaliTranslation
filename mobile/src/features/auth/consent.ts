/**
 * Draft contribution agreement. Live collection stays off until legal review.
 * Version must change when the text changes.
 */
export const CONTRIBUTION_CONSENT_VERSION = '2026-09-21.media';

/**
 * Topics required by INTENT: speech, photos, transcripts/OCR, edits, model outputs,
 * technical metadata, future model development/commercialization, human review,
 * retention, withdrawal, deletion timing, processors, and that core works without consent.
 */
export const CONTRIBUTION_CONSENT_SUMMARY = [
  'By saving consent you agree that NepTranslate may upload and store contribution text you submit,',
  'speech recordings you allow, Camera photos you capture for translation, transcripts and OCR text,',
  'your edits, model outputs, and related technical metadata for human review and for improving and',
  'commercializing language data and models.',
  'Contributed media may be retained indefinitely until you withdraw consent or delete your account;',
  'withdrawal or deletion schedules purge of linked contribution data within 30 days.',
  'Processors include our hosting and storage providers needed to run this pipeline.',
  'Ordinary guest translation history, clipboard, and non-consented media stay on this device only.',
  'Core Translate, Camera OCR, History, Settings, and Learn work without signing in or consenting.',
  'Do not contribute personal or sensitive content.',
  'Deleting the app account does not cancel an Apple subscription.',
].join(' ');

export type FeatureId =
  | 'translate'
  | 'conversation'
  | 'history'
  | 'settings'
  | 'learn'
  | 'contribute';

export type MediaKind = 'speech' | 'photo';

export function requiresSignIn(feature: FeatureId): boolean {
  return feature === 'contribute';
}

export function canSubmitContribution(input: {
  authConfigured: boolean;
  signedIn: boolean;
  consentVersion: string | null;
  ageConfirmed: boolean;
}): { ok: true } | { ok: false; reason: 'unavailable' | 'sign_in' | 'consent' | 'age' } {
  if (!input.authConfigured) return { ok: false, reason: 'unavailable' };
  if (!input.signedIn) return { ok: false, reason: 'sign_in' };
  if (input.consentVersion !== CONTRIBUTION_CONSENT_VERSION) {
    return { ok: false, reason: 'consent' };
  }
  if (!input.ageConfirmed) return { ok: false, reason: 'age' };
  return { ok: true };
}

/** Gate for post-consent automatic media upload (speech or photo). */
export function canUploadContributionMedia(input: {
  authConfigured: boolean;
  signedIn: boolean;
  consentVersion: string | null;
  ageConfirmed: boolean;
  kind: MediaKind;
  speechEnabled: boolean;
  photosEnabled: boolean;
}):
  | { ok: true }
  | {
      ok: false;
      reason: 'unavailable' | 'sign_in' | 'consent' | 'age' | 'flag_off' | 'guest';
    } {
  if (!input.signedIn) return { ok: false, reason: 'guest' };
  const base = canSubmitContribution(input);
  if (!base.ok) {
    if (base.reason === 'sign_in') return { ok: false, reason: 'guest' };
    return base;
  }
  if (input.kind === 'speech' && !input.speechEnabled) {
    return { ok: false, reason: 'flag_off' };
  }
  if (input.kind === 'photo' && !input.photosEnabled) {
    return { ok: false, reason: 'flag_off' };
  }
  return { ok: true };
}
