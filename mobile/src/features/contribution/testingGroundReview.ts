/**
 * Ten local Today's 10 rows for the Windows testing ground only.
 * Synthetic lines. Not gold, and not the public-review pool.
 */
import type { ReviewItem, ReviewWindowSummary } from './publicReviewApi';

export const TESTING_GROUND_REVIEW_WINDOW: ReviewWindowSummary = {
  window_id: 'tg-daily-10',
  ny_close_at: '2026-09-28T21:00:00.000Z',
  size: 10,
};

export const TESTING_GROUND_DAILY_REVIEW: ReviewItem[] = [
  {
    slot: 1,
    source_item_id: 'tg-daily-01',
    direction: 'en-ne',
    register: 'formal',
    script: 'deva',
    source_text: 'Please hold this blue ticket.',
    proposed_target: 'कृपया यो निलो टिकट समात्नुहोस्।',
    length_tier: 1,
    scheduled_credits: 2,
  },
  {
    slot: 2,
    source_item_id: 'tg-daily-02',
    direction: 'en-ne',
    register: 'informal',
    script: 'deva',
    source_text: 'Hold this blue ticket.',
    proposed_target: 'यो निलो टिकट समात्।',
    length_tier: 1,
    scheduled_credits: 2,
  },
  {
    slot: 3,
    source_item_id: 'tg-daily-03',
    direction: 'en-ne',
    register: 'formal',
    script: 'roman',
    source_text: 'The north gate closes at dusk.',
    proposed_target: 'uttar dhwaka beluka bandha hunchha.',
    length_tier: 1,
    scheduled_credits: 2,
  },
  {
    slot: 4,
    source_item_id: 'tg-daily-04',
    direction: 'ne-en',
    register: 'formal',
    script: 'deva',
    source_text: 'कृपया यो निलो टिकट समात्नुहोस्।',
    proposed_target: 'Please hold this blue ticket.',
    length_tier: 1,
    scheduled_credits: 2,
  },
  {
    slot: 5,
    source_item_id: 'tg-daily-05',
    direction: 'ne-en',
    register: 'informal',
    script: 'roman',
    source_text: 'yo nilo tikat samata.',
    proposed_target: 'Hold this blue ticket.',
    length_tier: 1,
    scheduled_credits: 2,
  },
  {
    slot: 6,
    source_item_id: 'tg-daily-06',
    direction: 'en-ne',
    register: 'formal',
    script: 'deva',
    source_text: 'Where is the river path?',
    proposed_target: 'नदीको बाटो कहाँ छ?',
    length_tier: 1,
    scheduled_credits: 2,
  },
  {
    slot: 7,
    source_item_id: 'tg-daily-07',
    direction: 'en-ne',
    register: 'informal',
    script: 'deva',
    source_text: 'The tea is too hot.',
    proposed_target: 'चिया एकदम तातो छ।',
    length_tier: 1,
    scheduled_credits: 2,
  },
  {
    slot: 8,
    source_item_id: 'tg-daily-08',
    direction: 'ne-en',
    register: 'formal',
    script: 'deva',
    source_text: 'नदीको बाटो कहाँ छ?',
    proposed_target: 'Where is the river path?',
    length_tier: 1,
    scheduled_credits: 2,
  },
  {
    slot: 9,
    source_item_id: 'tg-daily-09',
    direction: 'en-ne',
    register: 'formal',
    script: 'deva',
    source_text: 'Write the place name here.',
    proposed_target: null,
    length_tier: 1,
    scheduled_credits: 2,
  },
  {
    slot: 10,
    source_item_id: 'tg-daily-10',
    direction: 'en-ne',
    register: 'formal',
    script: 'deva',
    source_text:
      'Please walk past the stone bridge, keep the river on your left, and stop at the small tea shop before the north gate closes.',
    proposed_target:
      'कृपया ढुङ्गे पुल पार गर्नुहोस्, नदी बायाँ राख्नुहोस्, र उत्तर ढोका बन्द हुनुअघि सानो चिया पसलमा रोक्नुहोस्।',
    length_tier: 2,
    scheduled_credits: 4,
  },
];

export function isTestingGroundHarness(): boolean {
  if (typeof window === 'undefined') return false;
  const boot = (
    window as unknown as { __NEPTRANSLATE_TG__?: { harness?: string } }
  ).__NEPTRANSLATE_TG__;
  return boot?.harness === 'neptranslate-testing-ground';
}
