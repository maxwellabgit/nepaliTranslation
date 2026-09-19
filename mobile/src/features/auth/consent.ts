/**
 * Draft contribution agreement. Live collection stays off until legal review.
 * Version must change when the text changes.
 */
export const CONTRIBUTION_CONSENT_VERSION = '2026-09-19.draft';

export const CONTRIBUTION_CONSENT_SUMMARY = [
  'Only the text you explicitly submit is uploaded, not your ordinary translation history.',
  'Approved text may be reviewed by other people.',
  'Approved text may be used to improve and commercialize language data and models.',
  'Do not contribute personal or sensitive text.',
  'You can delete your account in Settings. Deleting the app account does not cancel an Apple subscription.',
].join(' ');

export type FeatureId =
  | 'translate'
  | 'conversation'
  | 'history'
  | 'settings'
  | 'learn'
  | 'contribute';

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
