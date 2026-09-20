import { DEFAULT_FEATURE_FLAGS } from '../../../app/featureFlags';
import { fetchNextContribution } from '../contributionApi';

describe('contributionApi', () => {
  test('disabled flag blocks network without requiring sign-in', async () => {
    expect(DEFAULT_FEATURE_FLAGS.contributionsEnabled).toBe(false);
    const result = await fetchNextContribution({
      signedIn: true,
      authConfigured: true,
    });
    expect(result).toEqual({ ok: false, reason: 'disabled' });
  });
});
