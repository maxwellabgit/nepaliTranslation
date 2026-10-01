import { t, type UiLang } from '../../i18n';
import { MINUTES_PER_CREDIT } from './reviewCredits';

/** Credits granted the first time the app is opened. */
export const FIRST_OPEN_CREDITS = 10;

/** Credits granted on the first open of each later New York day. */
export const DAILY_OPEN_CREDITS = 5;

export type WelcomeMessage = {
  id: string;
  title: Record<UiLang, string>;
  body: Record<UiLang, string>;
};

/**
 * First-open cards, in order. They finish before the credit award.
 * Append an item to show another card.
 */
export const FIRST_OPEN_WELCOME: WelcomeMessage[] = [
  {
    id: 'hello',
    title: {
      en: 'Welcome',
      ne: 'स्वागत छ',
    },
    body: {
      en: 'Translate English and Nepali on this phone. No account needed.',
      ne: 'तिमी यो फोनमै अङ्ग्रेजी र नेपाली अनुवाद गर्न सक्छौ। खाता चाहिँदैन।',
    },
  },
];

export type OpenAwardKind = 'welcome' | 'daily';

/** Short lines on the credit award that follows the last popup. */
export function openAwardCopy(
  kind: OpenAwardKind,
  lang: UiLang,
  credits: number,
): { title: string; body: string; rewardName: string } {
  const minutes = credits * MINUTES_PER_CREDIT;
  if (kind === 'welcome') {
    return {
      title: t('creditsAward.title', lang),
      body: t('openAward.welcomeBody', lang, { count: credits, minutes }),
      rewardName: t('openAward.welcomeReward', lang),
    };
  }
  return {
    title: t('dailyOpen.title', lang),
    body: t('dailyOpen.body', lang, { count: credits, minutes }),
    rewardName: t('openAward.dailyReward', lang),
  };
}
