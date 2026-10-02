import type { ReviewCategoryId } from './reviewFlow';
import type { RosterMeaning } from './reviewRoster';

export const REVIEW_EPOCH = '2026-09-29';
export const CATEGORY_SIZE = 10;

export const REVIEW_CATEGORIES = ['english', 'deva', 'roman'] as const;

export type DayCoins = Record<ReviewCategoryId, 0 | 1 | 2>;

export type ReviewDayState = {
  heldDay: number;
  seen: boolean;
  reviewed: string[];
  /** `${meaningId}:${category}` rows taken early as an Extra 10. */
  consumed: string[];
  coins: DayCoins;
  extra: ReviewCategoryId | null;
  /** Current visible roster-day per category, retained after extra completion. */
  categoryDays?: Partial<Record<ReviewCategoryId, number>>;
  categoryHistory?: Partial<Record<ReviewCategoryId, number[]>>;
};

const EMPTY_COINS: DayCoins = { english: 0, deva: 0, roman: 0 };

export function nyDateKey(ms: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms));
}

export function globalDayIndex(ms: number, epoch = REVIEW_EPOCH): number {
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', hourCycle: 'h23' }).format(new Date(ms)));
  // The daily review boundary is 5 PM local, with DST owned by the zone.
  const [year, month, day] = nyDateKey(ms).split('-').map(Number);
  const [epochYear, epochMonth, epochDay] = epoch.split('-').map(Number);
  const delta =
    Date.UTC(year, month - 1, day) - (hour < 17 ? 86_400_000 : 0) - Date.UTC(epochYear, epochMonth - 1, epochDay);
  return Math.max(0, Math.round(delta / 86_400_000));
}

export function freshReviewDay(globalDay: number): ReviewDayState {
  return {
    heldDay: globalDay,
    seen: false,
    reviewed: [],
    consumed: [],
    coins: { ...EMPTY_COINS },
    extra: null,
    categoryDays: {},
  };
}

/**
 * A new New York day keeps an unseen set.
 * A seen set rejoins the shared day. Extra-10 borrows stay in `consumed`.
 */
export function rollReviewDay(state: ReviewDayState, globalDay: number): ReviewDayState {
  if (!state.seen || globalDay <= state.heldDay) return state;
  return {
    ...state,
    heldDay: globalDay,
    seen: false,
    reviewed: [],
    coins: { ...EMPTY_COINS },
    extra: null,
    categoryDays: {},
  };
}

export function slotKey(meaningId: string, category: ReviewCategoryId): string {
  return `${meaningId}:${category}`;
}

function dayConsumed(
  day: RosterMeaning[],
  category: ReviewCategoryId,
  consumed: ReadonlySet<string>,
): boolean {
  return day.every((meaning) => consumed.has(slotKey(meaning.id, category)));
}

/** First day at or after `start` whose ten rows were not taken as an Extra 10. */
export function visibleDayIndex(
  days: RosterMeaning[][],
  start: number,
  category: ReviewCategoryId,
  consumed: readonly string[],
): number {
  const taken = new Set(consumed);
  let index = Math.max(0, start);
  while (index < days.length && dayConsumed(days[index], category, taken)) index += 1;
  return index;
}

export function categoryMeanings(
  days: RosterMeaning[][],
  state: ReviewDayState,
  globalDay: number,
  category: ReviewCategoryId,
): RosterMeaning[] {
  const start = state.seen ? globalDay : state.heldDay;
  let index = state.categoryDays?.[category] ?? visibleDayIndex(days, start, category, state.consumed);
  if (state.categoryDays?.[category] != null) return days[index] ?? [];
  if (state.extra === category) {
    index = visibleDayIndex(days, index + 1, category, state.consumed);
  }
  return days[index] ?? [];
}

export function noteSampleSeen(state: ReviewDayState): ReviewDayState {
  if (state.seen) return state;
  return { ...state, seen: true };
}

/**
 * Opening the first Extra 10 sample spends that next day, so tomorrow
 * does not show it again.
 */
export function noteExtraSeen(
  days: RosterMeaning[][],
  state: ReviewDayState,
  globalDay: number,
  category: ReviewCategoryId,
): ReviewDayState {
  if (state.extra !== category) return noteSampleSeen(state);
  const start = state.seen ? globalDay : state.heldDay;
  const todayIndex = visibleDayIndex(days, start, category, state.consumed);
  const extraIndex = visibleDayIndex(days, todayIndex + 1, category, state.consumed);
  const extraDay = days[extraIndex] ?? [];
  const consumed = new Set(state.consumed);
  for (const meaning of extraDay) consumed.add(slotKey(meaning.id, category));
  return { ...noteSampleSeen(state), consumed: [...consumed] };
}

export function noteReviewed(state: ReviewDayState, slot: string): ReviewDayState {
  if (state.reviewed.includes(slot)) return state;
  return { ...state, reviewed: [...state.reviewed, slot] };
}

export function noteCategoryCleared(
  state: ReviewDayState,
  category: ReviewCategoryId,
): ReviewDayState {
  const current = state.coins[category];
  if (state.extra === category) {
    return {
      ...state,
      extra: null,
      coins: { ...state.coins, [category]: 2 },
    };
  }
  if (current >= 1) return state;
  return { ...state, coins: { ...state.coins, [category]: 1 } };
}

export function beginExtra(
  state: ReviewDayState,
  category: ReviewCategoryId,
  days?: RosterMeaning[][],
  globalDay = state.heldDay,
): ReviewDayState {
  if (state.coins[category] < 1) return state;
  if (days) {
    const base = visibleDayIndex(days, state.seen ? globalDay : state.heldDay, category, []);
    const history = state.categoryHistory?.[category] ?? [base];
    const start = Math.max(...history, state.categoryDays?.[category] ?? base);
    const index = visibleDayIndex(days, start + 1, category, state.consumed);
    if (!days[index]?.length) return state;
    const consumed = new Set(state.consumed);
    for (const meaning of days[index]) consumed.add(slotKey(meaning.id, category));
    return { ...state, extra: category, categoryDays: { ...state.categoryDays, [category]: index }, categoryHistory: { ...state.categoryHistory, [category]: [...new Set([...history, index])] }, consumed: [...consumed] };
  }
  return { ...state, extra: category };
}

export function hasExtraSet(days: RosterMeaning[][], state: ReviewDayState, globalDay: number, category: ReviewCategoryId): boolean {
  const base = visibleDayIndex(days, state.seen ? globalDay : state.heldDay, category, []);
  const start = Math.max(base, ...(state.categoryHistory?.[category] ?? []), state.categoryDays?.[category] ?? base);
  return Boolean(days[visibleDayIndex(days, start + 1, category, state.consumed)]?.length);
}

/** Review popup coins: none when they only looked. The daily open award is separate. */
export function reviewPopupCoins(state: ReviewDayState): number {
  if (state.seen && state.reviewed.length === 0) return 0;
  return state.reviewed.length > 0 ? 1 : 0;
}
