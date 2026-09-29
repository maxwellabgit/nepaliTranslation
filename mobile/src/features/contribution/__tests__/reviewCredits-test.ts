import {
  GAUGE_CREDIT_MARK,
  countSourceWords,
  formatAdFreeClock,
  gaugePresentation,
  minutesForCredits,
  scheduledCreditsForWords,
  stackAdFreeMinutes,
} from '../reviewCredits';

describe('scheduledCreditsForWords', () => {
  test('splits samples into 1, 2, and 3 credits', () => {
    expect(scheduledCreditsForWords(0)).toBe(0);
    expect(scheduledCreditsForWords(4)).toBe(1);
    expect(scheduledCreditsForWords(5)).toBe(2);
    expect(scheduledCreditsForWords(6)).toBe(2);
    expect(scheduledCreditsForWords(7)).toBe(3);
    expect(countSourceWords('one two three four')).toBe(4);
    expect(countSourceWords('one two three four\n')).toBe(4);
    expect(countSourceWords('\n\n')).toBe(0);
    expect(minutesForCredits(3)).toBe(30);
  });
});

describe('stackAdFreeMinutes', () => {
  test('adds new time on top of time still left', () => {
    const stacked = stackAdFreeMinutes(40, 30);
    expect(stacked.remainingMinutes).toBe(70);
    expect(stacked.appliedMinutes).toBe(30);
    expect(stacked.capped).toBe(false);
  });

  test('stops at 12 hours', () => {
    const stacked = stackAdFreeMinutes(11 * 60, 3 * 60);
    expect(stacked.remainingMinutes).toBe(12 * 60);
    expect(stacked.appliedMinutes).toBe(60);
    expect(stacked.capped).toBe(true);
  });
});

describe('gaugePresentation', () => {
  const creditMs = (credits: number) => credits * 10 * 60_000;

  test('empty, 20, 50, and 55 credits', () => {
    const empty = gaugePresentation(0);
    expect(empty.fillPercent).toBe(0);
    expect(empty.clock).toBe('0:00:00');
    expect(empty.overMark).toBe(false);
    expect(empty.scale).toBe(1);

    const twenty = gaugePresentation(creditMs(20));
    expect(twenty.fillPercent).toBe(40);
    expect(twenty.clock).toBe('3:20:00');
    expect(twenty.overMark).toBe(false);

    const full = gaugePresentation(creditMs(GAUGE_CREDIT_MARK));
    expect(full.fillPercent).toBe(100);
    expect(full.clock).toBe('8:20:00');
    expect(full.overMark).toBe(false);
    expect(full.scale).toBe(1);

    const over = gaugePresentation(creditMs(55));
    expect(over.fillPercent).toBe(100);
    expect(over.clock).toBe('9:10:00');
    expect(over.overMark).toBe(true);
    expect(over.scale).toBe(1.08);
    expect(formatAdFreeClock(12 * 3600)).toBe('12:00:00');
  });
});
