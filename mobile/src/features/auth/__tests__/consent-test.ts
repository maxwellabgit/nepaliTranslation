import {
  canSubmitContribution,
  CONTRIBUTION_CONSENT_VERSION,
  CONTRIBUTION_CONSENT_SUMMARY,
  requiresSignIn,
} from '../consent';

describe('consent', () => {
  test('contribution consent summary is non-empty draft text', () => {
    expect(CONTRIBUTION_CONSENT_SUMMARY.length).toBeGreaterThan(40);
    expect(CONTRIBUTION_CONSENT_SUMMARY).toMatch(/translation history/i);
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
});
