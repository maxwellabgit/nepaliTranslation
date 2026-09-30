import {
  beginExtra,
  categoryMeanings,
  freshReviewDay,
  globalDayIndex,
  noteCategoryCleared,
  noteExtraSeen,
  noteSampleSeen,
  reviewPopupCoins,
  rollReviewDay,
  slotKey,
} from '../reviewDayPlan';
import { REVIEW_DAYS } from '../reviewRoster';
import type { RosterMeaning } from '../reviewRoster';

function meaning(id: string): RosterMeaning {
  return { id, english: id, deva: id, roman: id };
}

const days = [
  [meaning('a1'), meaning('a2')],
  [meaning('b1'), meaning('b2')],
  [meaning('c1'), meaning('c2')],
];

describe('review day lineup', () => {
  it('lines every complete day from the review pool', () => {
    expect(REVIEW_DAYS.length).toBe(37);
    for (const day of REVIEW_DAYS) {
      expect(day).toHaveLength(10);
      for (const row of day) {
        expect(row.english.length).toBeGreaterThan(0);
        expect(row.deva.length).toBeGreaterThan(0);
        expect(row.roman.length).toBeGreaterThan(0);
      }
    }
  });

  it('keeps an unseen set when the calendar moves ahead', () => {
    const held = freshReviewDay(0);
    const next = rollReviewDay(held, 2);
    expect(next.heldDay).toBe(0);
    expect(categoryMeanings(days, next, 2, 'english').map((row) => row.id)).toEqual([
      'a1',
      'a2',
    ]);
  });

  it('rejoins everyone the day after a sample was seen', () => {
    const seen = noteSampleSeen(freshReviewDay(0));
    const next = rollReviewDay(seen, 2);
    expect(next.heldDay).toBe(2);
    expect(next.seen).toBe(false);
    expect(next.coins.english).toBe(0);
    expect(categoryMeanings(days, next, 2, 'deva').map((row) => row.id)).toEqual([
      'c1',
      'c2',
    ]);
  });

  it('awards no review coins when a sample was seen and none were submitted', () => {
    expect(reviewPopupCoins(noteSampleSeen(freshReviewDay(0)))).toBe(0);
  });

  it('puts one coin on a finished category and two after its Extra 10', () => {
    let state = noteCategoryCleared(freshReviewDay(0), 'english');
    expect(state.coins.english).toBe(1);
    state = beginExtra(state, 'english');
    expect(categoryMeanings(days, state, 0, 'english').map((row) => row.id)).toEqual([
      'b1',
      'b2',
    ]);
    state = noteExtraSeen(days, state, 0, 'english');
    expect(state.consumed).toEqual([slotKey('b1', 'english'), slotKey('b2', 'english')]);
    state = noteCategoryCleared(state, 'english');
    expect(state.coins.english).toBe(2);
    expect(state.extra).toBeNull();
  });

  it('does not repeat an Extra 10 the next day, and a missed day rejoins the pack', () => {
    let state = beginExtra(noteCategoryCleared(freshReviewDay(0), 'roman'), 'roman');
    state = noteExtraSeen(days, state, 0, 'roman');
    const nextMorning = rollReviewDay({ ...state, seen: true }, 1);
    expect(categoryMeanings(days, nextMorning, 1, 'roman').map((row) => row.id)).toEqual([
      'c1',
      'c2',
    ]);
    const skipped = rollReviewDay({ ...state, seen: true }, 2);
    expect(categoryMeanings(days, skipped, 2, 'roman').map((row) => row.id)).toEqual([
      'c1',
      'c2',
    ]);
  });

  it('leaves tomorrow untouched when Extra 10 is never opened', () => {
    const finished = noteCategoryCleared(noteSampleSeen(freshReviewDay(0)), 'english');
    const tomorrow = rollReviewDay(finished, 1);
    expect(tomorrow.consumed).toEqual([]);
    expect(categoryMeanings(days, tomorrow, 1, 'english').map((row) => row.id)).toEqual([
      'b1',
      'b2',
    ]);
  });

  it('counts New York dates from the lineup epoch', () => {
    expect(globalDayIndex(Date.parse('2026-09-29T16:00:00.000Z'))).toBe(0);
    expect(globalDayIndex(Date.parse('2026-09-30T16:00:00.000Z'))).toBe(1);
  });
});
