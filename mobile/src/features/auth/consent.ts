import { en } from '../../i18n/en';

/**
 * Draft contribution agreement. Live collection stays off until legal review.
 * Version must change when the English text changes.
 */
export const CONTRIBUTION_CONSENT_VERSION = '2026-10-02.guest';

/**
 * English statement shown in Settings. Nepali uses the same key in the UI catalog.
 * Topics required by INTENT: speech, photos, transcripts/OCR, edits, model outputs,
 * technical metadata, future model development/commercialization, human review,
 * retention, withdrawal, deletion timing, processors, and that core works without consent.
 */
export const CONTRIBUTION_CONSENT_SUMMARY = en['auth.contributionConsentBody'];

export type FeatureId =
  | 'translate'
  | 'conversation'
  | 'history'
  | 'settings'
  | 'learn'
  | 'contribute';

export type MediaKind = 'speech' | 'photo';

export function requiresSignIn(feature: FeatureId): boolean {
  void feature;
  return false;
}

export function canSubmitContribution(input: {
  authConfigured: boolean;
  signedIn: boolean;
  consentVersion: string | null;
  ageConfirmed: boolean;
}): { ok: true } | { ok: false; reason: 'unavailable' | 'consent' | 'age' } {
  if (!input.authConfigured) return { ok: false, reason: 'unavailable' };
  if (!input.signedIn) return { ok: false, reason: 'unavailable' };
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
      reason: 'unavailable' | 'consent' | 'age' | 'flag_off' | 'guest';
    } {
  if (!input.signedIn) return { ok: false, reason: 'guest' };
  const base = canSubmitContribution(input);
  if (!base.ok) {
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
