import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ReviewCategoryId } from './reviewFlow';
import { REVIEW_DAYS } from './reviewRoster';
import {
  beginExtra,
  categoryMeanings,
  freshReviewDay,
  globalDayIndex,
  noteCategoryCleared,
  noteExtraSeen,
  noteReviewed,
  noteSampleSeen,
  rollReviewDay,
  type ReviewDayState,
} from './reviewDayPlan';

const KEY = 'neptranslate.reviewDay.v1';
let mutationChain: Promise<unknown> = Promise.resolve();

function normalize(value: Partial<ReviewDayState> | null, globalDay: number): ReviewDayState {
  const fresh = freshReviewDay(globalDay);
  if (!value) return fresh;
  return {
    heldDay: Number.isFinite(value.heldDay) ? Number(value.heldDay) : fresh.heldDay,
    seen: Boolean(value.seen),
    reviewed: Array.isArray(value.reviewed) ? value.reviewed : [],
    consumed: Array.isArray(value.consumed) ? value.consumed : [],
    coins: {
      english: value.coins?.english === 2 ? 2 : value.coins?.english === 1 ? 1 : 0,
      deva: value.coins?.deva === 2 ? 2 : value.coins?.deva === 1 ? 1 : 0,
      roman: value.coins?.roman === 2 ? 2 : value.coins?.roman === 1 ? 1 : 0,
    },
    extra: value.extra === 'english' || value.extra === 'deva' || value.extra === 'roman'
      ? value.extra
      : null,
    categoryDays: Object.fromEntries(Object.entries(value.categoryDays ?? {}).filter(([key, index]) => ['english', 'deva', 'roman'].includes(key) && Number.isInteger(index) && Number(index) >= 0)),
    categoryHistory: Object.fromEntries(Object.entries(value.categoryHistory ?? {}).filter(([key, indexes]) => ['english', 'deva', 'roman'].includes(key) && Array.isArray(indexes)).map(([key, indexes]) => [key, indexes!.filter((index) => Number.isInteger(index) && index >= 0 && index < REVIEW_DAYS.length)])),
  };
}

async function save(state: ReviewDayState): Promise<ReviewDayState> {
  await AsyncStorage.setItem(KEY, JSON.stringify(state));
  return state;
}

export async function loadReviewDay(now = new Date()): Promise<ReviewDayState> {
  const globalDay = globalDayIndex(now.getTime());
  const raw = await AsyncStorage.getItem(KEY);
  let parsed: Partial<ReviewDayState> | null = null;
  if (raw) {
    try {
      parsed = JSON.parse(raw) as Partial<ReviewDayState>;
    } catch {
      parsed = null;
    }
  }
  return save(rollReviewDay(normalize(parsed, globalDay), globalDay));
}

async function update(
  now: Date,
  change: (state: ReviewDayState, globalDay: number) => ReviewDayState,
): Promise<ReviewDayState> {
  const run = mutationChain.then(async () => {
    const current = await loadReviewDay(now);
    return save(change(current, globalDayIndex(now.getTime())));
  });
  mutationChain = run.catch(() => undefined);
  return run;
}

export function markSampleSeen(now = new Date()): Promise<ReviewDayState> {
  return update(now, (state, globalDay) =>
    state.extra && state.categoryDays?.[state.extra] == null
      ? noteExtraSeen(REVIEW_DAYS, state, globalDay, state.extra)
      : noteSampleSeen(state),
  );
}

export function markReviewed(slot: string, now = new Date()): Promise<ReviewDayState> {
  return update(now, (state) => noteReviewed(state, slot));
}

export function markCategoryCleared(
  category: ReviewCategoryId,
  now = new Date(),
): Promise<ReviewDayState> {
  return update(now, (state, globalDay) => {
    const first = categoryMeanings(REVIEW_DAYS, state, globalDay, category)[0];
    const index = REVIEW_DAYS.findIndex((rows) => rows.some((row) => row.id === first?.id));
    const cleared = noteCategoryCleared(state, category);
    if (index < 0) return cleared;
    return { ...cleared, categoryHistory: { ...state.categoryHistory, [category]: [...new Set([...(state.categoryHistory?.[category] ?? []), index])] } };
  });
}

export function markExtraBegun(
  category: ReviewCategoryId,
  now = new Date(),
): Promise<ReviewDayState> {
  return update(now, (state, globalDay) => beginExtra(state, category, REVIEW_DAYS, globalDay));
}

export function selectReviewSet(category: ReviewCategoryId, index: number, now = new Date()): Promise<ReviewDayState> {
  return update(now, (state) => {
    if (!state.categoryHistory?.[category]?.includes(index)) return state;
    return { ...state, extra: null, categoryDays: { ...state.categoryDays, [category]: index } };
  });
}
