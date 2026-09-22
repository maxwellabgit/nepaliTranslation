import {
  canSubmitContribution,
  canUploadContributionMedia,
  CONTRIBUTION_CONSENT_VERSION,
  CONTRIBUTION_CONSENT_SUMMARY,
  requiresSignIn,
} from '../consent';

describe('consent', () => {
  test('contribution consent summary covers required media topics', () => {
    expect(CONTRIBUTION_CONSENT_SUMMARY.length).toBeGreaterThan(40);
    expect(CONTRIBUTION_CONSENT_SUMMARY).toMatch(/speech/i);
    expect(CONTRIBUTION_CONSENT_SUMMARY).toMatch(/photo/i);
    expect(CONTRIBUTION_CONSENT_SUMMARY).toMatch(/OCR|transcript/i);
    expect(CONTRIBUTION_CONSENT_SUMMARY).toMatch(/30 days/i);
    expect(CONTRIBUTION_CONSENT_SUMMARY).toMatch(/withdraw/i);
    expect(CONTRIBUTION_CONSENT_SUMMARY).toMatch(/without signing in|without consent/i);
    expect(CONTRIBUTION_CONSENT_VERSION).toBe('2026-09-21.media');
  });

  test('requiresSignIn is true only for contribute', () => {
    expect(requiresSignIn('conversation')).toBe(false);
    expect(requiresSignIn('contribute')).toBe(true);
  });

  test('canSubmitContribution gates auth, consent version, and age', () => {
    expect(
      canSubmitContribution({
        authConfigured: false,
        signedIn: true,
        consentVersion: CONTRIBUTION_CONSENT_VERSION,
        ageConfirmed: true,
      }),
    ).toEqual({ ok: false, reason: 'unavailable' });

    expect(
      canSubmitContribution({
        authConfigured: true,
        signedIn: false,
        consentVersion: CONTRIBUTION_CONSENT_VERSION,
        ageConfirmed: true,
      }),
    ).toEqual({ ok: false, reason: 'sign_in' });

    expect(
      canSubmitContribution({
        authConfigured: true,
        signedIn: true,
        consentVersion: 'old-version',
        ageConfirmed: true,
      }),
    ).toEqual({ ok: false, reason: 'consent' });

    expect(
      canSubmitContribution({
        authConfigured: true,
        signedIn: true,
        consentVersion: CONTRIBUTION_CONSENT_VERSION,
        ageConfirmed: false,
      }),
    ).toEqual({ ok: false, reason: 'age' });

    expect(
      canSubmitContribution({
        authConfigured: true,
        signedIn: true,
        consentVersion: CONTRIBUTION_CONSENT_VERSION,
        ageConfirmed: true,
      }),
    ).toEqual({ ok: true });
  });

  test('canUploadContributionMedia blocks guests, under-18, flag-off', () => {
    expect(
      canUploadContributionMedia({
        authConfigured: true,
        signedIn: false,
        consentVersion: CONTRIBUTION_CONSENT_VERSION,
        ageConfirmed: true,
        kind: 'photo',
        speechEnabled: true,
        photosEnabled: true,
      }),
    ).toEqual({ ok: false, reason: 'guest' });

    expect(
      canUploadContributionMedia({
        authConfigured: true,
        signedIn: true,
        consentVersion: CONTRIBUTION_CONSENT_VERSION,
        ageConfirmed: false,
        kind: 'photo',
        speechEnabled: true,
        photosEnabled: true,
      }),
    ).toEqual({ ok: false, reason: 'age' });

    expect(
      canUploadContributionMedia({
        authConfigured: true,
        signedIn: true,
        consentVersion: CONTRIBUTION_CONSENT_VERSION,
        ageConfirmed: true,
        kind: 'photo',
        speechEnabled: true,
        photosEnabled: false,
      }),
    ).toEqual({ ok: false, reason: 'flag_off' });

    expect(
      canUploadContributionMedia({
        authConfigured: true,
        signedIn: true,
        consentVersion: CONTRIBUTION_CONSENT_VERSION,
        ageConfirmed: true,
        kind: 'speech',
        speechEnabled: false,
        photosEnabled: true,
      }),
    ).toEqual({ ok: false, reason: 'flag_off' });

    expect(
      canUploadContributionMedia({
        authConfigured: true,
        signedIn: true,
        consentVersion: CONTRIBUTION_CONSENT_VERSION,
        ageConfirmed: true,
        kind: 'photo',
        speechEnabled: false,
        photosEnabled: true,
      }),
    ).toEqual({ ok: true });
  });
});
