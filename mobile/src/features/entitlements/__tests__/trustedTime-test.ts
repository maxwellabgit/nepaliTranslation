import {
  clockSkewCannotMint,
  measureServerOffset,
  stackAdFreeExpiry,
  trustedNowMs,
} from '../trustedTime';

describe('trustedTime', () => {
  it('stacks from max(now, expiry)', () => {
    const now = 1_000_000;
    expect(
      stackAdFreeExpiry({
        trustedNowMs: now,
        currentExpiryMs: null,
        minutes: 5,
      }),
    ).toBe(now + 5 * 60_000);
    expect(
      stackAdFreeExpiry({
        trustedNowMs: now,
        currentExpiryMs: now + 10 * 60_000,
        minutes: 5,
      }),
    ).toBe(now + 15 * 60_000);
  });

  it('device clock skew alone cannot mint ad-free time', () => {
    const clock = measureServerOffset(1_000_000, 5_000_000, 100);
    expect(
      clockSkewCannotMint({
        clock,
        currentExpiryMs: null,
        minutes: 10,
        skewMs: 86_400_000,
        monoNowMs: 100,
      }),
    ).toBe(true);
    expect(trustedNowMs(1_000_000 + 86_400_000, clock, 100)).toBe(5_000_000);
    expect(trustedNowMs(1_000_000, clock, 100 + 60_000)).toBe(5_000_000 + 60_000);
  });

  it('trustedNowMs without clock falls back to device time', () => {
    expect(trustedNowMs(42_000, null)).toBe(42_000);
  });

  it('stackAdFreeExpiry uses trusted now when expiry is in the past', () => {
    const now = 2_000_000;
    expect(
      stackAdFreeExpiry({
        trustedNowMs: now,
        currentExpiryMs: now - 60_000,
        minutes: 5,
      }),
    ).toBe(now + 5 * 60_000);
  });
});
