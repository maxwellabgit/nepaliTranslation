import type { ReviewItem } from './publicReviewApi';
import { countSourceWords, scheduledCreditsForWords } from './reviewCredits';
import {
  categoryMeanings,
  globalDayIndex,
  slotKey,
  type ReviewDayState,
} from './reviewDayPlan';
import { REVIEW_DAYS, type RosterMeaning } from './reviewRoster';
import type { ReviewCategoryId } from './reviewFlow';

function itemFrom(
  meaning: RosterMeaning,
  category: ReviewCategoryId,
  slot: number,
): ReviewItem {
  const english = category === 'english';
  const source = english ? meaning.english : category === 'deva' ? meaning.deva : meaning.roman;
  const target = english ? meaning.deva : meaning.english;
  const credits = scheduledCreditsForWords(countSourceWords(source));
  return {
    slot,
    source_item_id: slotKey(meaning.id, category),
    direction: english ? 'en-ne' : 'ne-en',
    register: 'formal',
    script: category === 'roman' ? 'roman' : 'deva',
    source_text: source,
    proposed_target: target,
    length_tier: credits >= 3 ? 2 : 1,
    scheduled_credits: credits === 0 ? 1 : credits,
  };
}

export function itemsForReviewDay(state: ReviewDayState, now = new Date()): ReviewItem[] {
  const globalDay = globalDayIndex(now.getTime());
  const categories: ReviewCategoryId[] = ['english', 'deva', 'roman'];
  const items: ReviewItem[] = [];
  let slot = 1;
  for (const category of categories) {
    for (const meaning of categoryMeanings(REVIEW_DAYS, state, globalDay, category)) {
      items.push(itemFrom(meaning, category, slot));
      slot += 1;
    }
  }
  return items;
}

export function reviewWindowId(state: ReviewDayState, now = new Date()): string {
  const globalDay = globalDayIndex(now.getTime());
  const day = state.seen ? globalDay : state.heldDay;
  return `review-day-${day}`;
}
