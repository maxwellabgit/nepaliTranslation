import { authReducer, INITIAL_AUTH, keepsLocalHistory } from '../authPolicy';
test('a subject switch cannot inherit prior contribution consent', () => {
  const a = { ...INITIAL_AUTH, userId: 'a', consentVersion: 'current', ageConfirmed: true };
  expect(authReducer(a, { type: 'ready_session', userId: 'b' })).toEqual(expect.objectContaining({ userId: 'b', consentVersion: null, ageConfirmed: false }));
  expect(authReducer(a, { type: 'ready_session', userId: 'a' }).consentVersion).toBe('current');
});
test('an unavailable identity retains its subject and deletion deadline while denying uploads', () => {
  const a = { ...INITIAL_AUTH, userId: 'a', consentVersion: 'current', ageConfirmed: true, deletionDueAt: 'deadline' };
  expect(authReducer(a, { type: 'identity_unavailable' })).toEqual(expect.objectContaining({ status: 'guest', userId: 'a', consentVersion: null, ageConfirmed: false, deletionDueAt: 'deadline' }));
});
test('accepted shared-data deletion preserves identity and deadline without consent', () => {
  const signed = authReducer(INITIAL_AUTH, { type: 'ready_session', userId: 'a' });
  const scheduled = authReducer(signed, { type: 'deletion_scheduled', deletionDueAt: 'deadline', message: 'Requested' });
  expect(scheduled).toEqual(expect.objectContaining({ status: 'signed-in', userId: 'a', deletionDueAt: 'deadline', consentVersion: null, ageConfirmed: false }));
});
test('paused deletion remains retryable after a same-subject session refresh', () => {
  const signed = authReducer(INITIAL_AUTH, { type: 'ready_session', userId: 'a' });
  const paused = authReducer(signed, { type: 'deletion_paused', message: 'Offline' });
  expect(authReducer(paused, { type: 'ready_session', userId: 'a' }).deletionRetryPending).toBe(true);
  expect(keepsLocalHistory('session_revoked')).toBe(true);
});
