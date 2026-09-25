import { adFreeBalance, creditProgress, CREDIT_THRESHOLDS } from '../creditProgress';

describe('creditProgress', () => {
  test('progresses toward the next explicit threshold', () => {
    expect(CREDIT_THRESHOLDS[0]).toBe(10);
    const zero = creditProgress(0);
    expect(zero.nextThreshold).toBe(10);
    expect(zero.percent).toBeGreaterThanOrEqual(4);
    expect(zero.accessibilityLabel).toContain('10');

    const mid = creditProgress(5);
    expect(mid.nextThreshold).toBe(10);
    expect(mid.percent).toBe(50);

    const past = creditProgress(240);
    expect(past.nextThreshold).toBeNull();
    expect(past.percent).toBe(100);
  });
});

describe('adFreeBalance', () => {
  const now = Date.parse('2026-09-25T12:00:00.000Z');

  test('shows remaining time and labels lifetime credits as total earned', () => {
    const balance = adFreeBalance({
      earnedUntilMs: now + 30 * 60_000,
      nowMs: now,
      lifetimeCredits: 7,
    });
    expect(balance.remainingLabel).toBe('30 min ad-free left');
    expect(balance.totalEarnedLabel).toBe('Total earned: 7');
    expect(balance.remainingLabel).not.toContain('7');
  });

  test('a passed expiry is not a spendable balance', () => {
    const balance = adFreeBalance({
      earnedUntilMs: now - 1,
      nowMs: now,
      lifetimeCredits: 4,
    });
    expect(balance.remainingLabel).toBe('No ad-free time');
    expect(balance.totalEarnedLabel).toBe('Total earned: 4');
  });
});
