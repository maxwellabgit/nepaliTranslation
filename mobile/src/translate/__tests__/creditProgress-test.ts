import { creditProgress, CREDIT_THRESHOLDS } from '../creditProgress';

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
