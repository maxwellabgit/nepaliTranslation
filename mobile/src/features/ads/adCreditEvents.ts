import { grantLocalAdCredits } from '../contribution/dailyOpen';

export type AdCreditAward = { credits: number; minutes: number; capped: boolean; fromRemainingMs: number; toRemainingMs: number; coinCount: number; automaticFlight: true };
const listeners = new Set<(award: AdCreditAward) => void>();
export function subscribeAdCreditAwards(listener: (award: AdCreditAward) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function publishAdCreditAward(award: Omit<AdCreditAward, 'coinCount' | 'automaticFlight'>) {
  listeners.forEach(listener => listener({ ...award, coinCount: award.credits, automaticFlight: true }));
}
/** 2-credit local awards are browser test ads only; native full rewards retain SSV. */
export async function awardDismissedAd(credits: 1 | 2, visibleUntilMs: number | null = null) {
  const award = await grantLocalAdCredits(credits, Date.now(), visibleUntilMs);
  if (award) publishAdCreditAward(award);
}
