/**
 * Local Today's 10 rows for the Windows testing ground only.
 * Ten synthetic lines in each working-from category.
 * Not gold, and not the public-review pool.
 */
import type { ReviewItem, ReviewWindowSummary } from './publicReviewApi';
import { countSourceWords, scheduledCreditsForWords } from './reviewCredits';

export const TESTING_GROUND_REVIEW_WINDOW: ReviewWindowSummary = {
  window_id: 'tg-daily-10',
  ny_close_at: '2026-09-28T21:00:00.000Z',
  size: 30,
};

function row(
  slot: number,
  id: string,
  direction: ReviewItem['direction'],
  script: string,
  source: string,
  target: string | null,
): ReviewItem {
  const credits = scheduledCreditsForWords(countSourceWords(source));
  return {
    slot,
    source_item_id: id,
    direction,
    register: 'formal',
    script,
    source_text: source,
    proposed_target: target,
    length_tier: credits >= 3 ? 2 : 1,
    scheduled_credits: credits === 0 ? 1 : credits,
  };
}

const DEVANAGARI: ReviewItem[] = [
  row(1, 'tg-deva-01', 'ne-en', 'deva', 'कृपया यो निलो टिकट समात्नुहोस्।', 'Please hold this blue ticket.'),
  row(2, 'tg-deva-02', 'ne-en', 'deva', 'नदीको बाटो कहाँ छ?', 'Where is the river path?'),
  row(3, 'tg-deva-03', 'ne-en', 'deva', 'चिया एकदम तातो छ।', 'The tea is very hot.'),
  row(4, 'tg-deva-04', 'ne-en', 'deva', 'ढोका बन्द गर्नुहोस्।', 'Please close the door.'),
  row(5, 'tg-deva-05', 'ne-en', 'deva', 'म भोलि काठमाडौं जान्छु।', 'I am going to Kathmandu tomorrow.'),
  row(6, 'tg-deva-06', 'ne-en', 'deva', 'यो बस रत्नपार्क जान्छ?', 'Does this bus go to Ratna Park?'),
  row(7, 'tg-deva-07', 'ne-en', 'deva', 'पानी अलि चिसो छ।', 'The water is a little cold.'),
  row(8, 'tg-deva-08', 'ne-en', 'deva', 'किताब टेबलमा छ।', 'The book is on the table.'),
  row(9, 'tg-deva-09', 'ne-en', 'deva', 'कृपया बिस्तारै बोल्नुहोस्।', 'Please speak slowly.'),
  row(10, 'tg-deva-10', 'ne-en', 'deva', 'हामी तीन बजे भेटौँला।', "Let's meet at three o'clock."),
];

const ROMANIZED: ReviewItem[] = [
  row(11, 'tg-roman-01', 'ne-en', 'roman', 'yo nilo tikat samata.', 'Hold this blue ticket.'),
  row(12, 'tg-roman-02', 'ne-en', 'roman', 'nadi ko bato kaha chha?', 'Where is the river path?'),
  row(13, 'tg-roman-03', 'ne-en', 'roman', 'chiya ekdam tato chha.', 'The tea is very hot.'),
  row(14, 'tg-roman-04', 'ne-en', 'roman', 'dhoka banda garnus.', 'Please close the door.'),
  row(15, 'tg-roman-05', 'ne-en', 'roman', 'ma bholi kathmandu janchhu.', 'I am going to Kathmandu tomorrow.'),
  row(16, 'tg-roman-06', 'ne-en', 'roman', 'yo bus ratnapark janchha?', 'Does this bus go to Ratna Park?'),
  row(17, 'tg-roman-07', 'ne-en', 'roman', 'pani ali chiso chha.', 'The water is a little cold.'),
  row(18, 'tg-roman-08', 'ne-en', 'roman', 'kitab table ma chha.', 'The book is on the table.'),
  row(19, 'tg-roman-09', 'ne-en', 'roman', 'bistaraai bolnus.', 'Please speak slowly.'),
  row(20, 'tg-roman-10', 'ne-en', 'roman', 'hami tin baje bhetaula.', "Let's meet at three o'clock."),
];

const ENGLISH: ReviewItem[] = [
  row(21, 'tg-en-01', 'en-ne', 'deva', 'Please hold this blue ticket.', 'कृपया यो निलो टिकट समात्नुहोस्।'),
  row(22, 'tg-en-02', 'en-ne', 'deva', 'Where is the river path?', 'नदीको बाटो कहाँ छ?'),
  row(23, 'tg-en-03', 'en-ne', 'deva', 'The tea is too hot.', 'चिया एकदम तातो छ।'),
  row(24, 'tg-en-04', 'en-ne', 'deva', 'Write the place name here.', null),
  row(25, 'tg-en-05', 'en-ne', 'deva', 'The north gate closes at dusk.', 'उत्तर ढोका बेलुका बन्द हुन्छ।'),
  row(26, 'tg-en-06', 'en-ne', 'deva', 'How much is this?', 'यो कति हो?'),
  row(27, 'tg-en-07', 'en-ne', 'deva', 'I need a glass of water.', 'मलाई एक गिलास पानी चाहियो।'),
  row(28, 'tg-en-08', 'en-ne', 'deva', 'The market is closed today.', 'बजार आज बन्द छ।'),
  row(29, 'tg-en-09', 'en-ne', 'deva', 'Please wait here.', 'कृपया यहाँ पर्खनुहोस्।'),
  row(
    30,
    'tg-en-10',
    'en-ne',
    'deva',
    'Please walk past the stone bridge, keep the river on your left, and stop at the small tea shop before the north gate closes.',
    'कृपया ढुङ्गे पुल पार गर्नुहोस्, नदी बायाँ राख्नुहोस्, र उत्तर ढोका बन्द हुनुअघि सानो चिया पसलमा रोक्नुहोस्।',
  ),
];

export const TESTING_GROUND_DAILY_REVIEW: ReviewItem[] = [
  ...DEVANAGARI,
  ...ROMANIZED,
  ...ENGLISH,
];

export function isTestingGroundHarness(): boolean {
  if (typeof window === 'undefined') return false;
  const boot = (
    window as unknown as { __NEPTRANSLATE_TG__?: { harness?: string } }
  ).__NEPTRANSLATE_TG__;
  return boot?.harness === 'neptranslate-testing-ground';
}
