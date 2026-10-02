import { t, type UiLang } from '../../i18n';
import { MINUTES_PER_CREDIT } from './reviewCredits';

/** Credits granted the first time the app is opened. */
export const FIRST_OPEN_CREDITS = 10;

/** Credits granted on the first open of each later New York day. */
export const DAILY_OPEN_CREDITS = 5;

export type OpenAwardKind = 'welcome' | 'daily';

/** Copy for the single first-open or daily award popup. */
export function openAwardCopy(
  kind: OpenAwardKind,
  lang: UiLang,
  credits: number,
  cappedMinutesApplied?: number,
): { title: string; body: string; rewardName: string } {
  const minutes = credits * MINUTES_PER_CREDIT;
  if (kind === 'welcome') {
    return {
      title: t('creditsAward.title', lang),
      body: cappedMinutesApplied === undefined
        ? t('openAward.welcomeBody', lang, { count: credits, minutes })
        : t('openAward.cappedBody', lang, { count: credits, minutes: Number(cappedMinutesApplied.toFixed(1)) }),
      rewardName: t('openAward.welcomeReward', lang),
    };
  }
  return {
    title: t('dailyOpen.title', lang),
    body: cappedMinutesApplied === undefined
      ? t('dailyOpen.body', lang, { count: credits, minutes })
      : t('openAward.cappedBody', lang, { count: credits, minutes: Number(cappedMinutesApplied.toFixed(1)) }),
    rewardName: t('openAward.dailyReward', lang),
  };
}
