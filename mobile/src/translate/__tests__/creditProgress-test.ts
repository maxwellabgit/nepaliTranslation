import { adFreeBalance, creditProgress } from '../creditProgress';

describe('creditProgress', () => {
  test('uses 50 as a visual mark and still reports credits past it', () => {
    expect(creditProgress(0).fillPercent).toBe(0);
    expect(creditProgress(20).fillPercent).toBe(40);
    expect(creditProgress(50).fillPercent).toBe(100);
    expect(creditProgress(50).overMark).toBe(false);
    const over = creditProgress(55);
    expect(over.credits).toBe(55);
    expect(over.fillPercent).toBe(100);
    expect(over.overMark).toBe(true);
    expect(over.visualMark).toBe(50);
  });
});

describe('adFreeBalance', () => {
  const now = Date.parse('2026-09-25T12:00:00.000Z');

  test('shows remaining time and does not clamp the lifetime label', () => {
    const balance = adFreeBalance({
      earnedUntilMs: now + 30 * 60_000,
      nowMs: now,
      lifetimeCredits: 55,
    });
    expect(balance.remainingLabel).toBe('30 min ad-free left');
    expect(balance.totalEarnedLabel).toBe('Total earned: 55');
  });

  test('a passed expiry is not a spendable balance', () => {
    const balance = adFreeBalance({
      earnedUntilMs: now - 1,
      nowMs: now,
      lifetimeCredits: 4,
    });
    expect(balance.remainingLabel).toBe('');
    expect(balance.totalEarnedLabel).toBe('Total earned: 4');
  });
});
