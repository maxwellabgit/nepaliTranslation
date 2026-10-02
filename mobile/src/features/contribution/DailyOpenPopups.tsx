import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useUiLang } from '../../i18n';
import { useEntitlementOptional } from '../entitlements/EntitlementProvider';
import { presentCreditClaim, useCreditAwardOptional } from '../../translate/CreditAwardProvider';
import { minutesForCredits } from './reviewCredits';
import { grantDailyOpenCoin, laterActiveUntil, readDailyOpen } from './dailyOpen';
import { awardSurfaceIsBusy, subscribeAwardSurface } from '../../translate/awardSurface';
import { openAwardCopy } from './openWelcome';
import { nyDateKey } from './reviewDayPlan';

/** One readable award over Home; Continue dismisses it and starts the flight. */
export function DailyOpenPopups() {
  const lang = useUiLang();
  const award = useCreditAwardOptional();
  const entitlement = useEntitlementOptional();
  const current = useRef({ lang, award, entitlement });
  current.current = { lang, award, entitlement };
  useEffect(() => {
    let cancelled = false;
    let preparing = false;
    const consider = async () => {
      if (cancelled || preparing || awardSurfaceIsBusy() || current.current.award.phase !== 'idle') return;
      preparing = true;
      const api = current.current.award;
      api.holdAwards();
      try {
        const nowMs = Date.now();
        const before = await readDailyOpen();
        if (cancelled) return;
        if (before?.nyDate === nyDateKey(nowMs) && !before.pendingFlight) return;
        const beforeUntil = laterActiveUntil(before?.untilMs, current.current.entitlement?.earnedAdFreeUntilMs, nowMs);
        const saved = await grantDailyOpenCoin(new Date(nowMs), beforeUntil);
        if (cancelled || !saved.pendingFlight) return;
        const flight = saved.pendingFlight;
        const presentation = presentCreditClaim({
          nowMs,
          earnedUntilMs: flight.fromUntilMs !== undefined
            ? flight.fromUntilMs
            : before?.pendingFlight
              ? Math.max(nowMs, saved.untilMs - minutesForCredits(flight.credits) * 60_000)
              : beforeUntil,
          credits: flight.credits,
          minutesApplied: flight.minutesApplied ?? minutesForCredits(flight.credits),
          capped: flight.capped ?? false,
        });
        api.startAward({ ...presentation, toRemainingMs: Math.max(0, saved.untilMs - nowMs),
          ...openAwardCopy(flight.kind, current.current.lang, flight.credits, flight.capped ? flight.minutesApplied : undefined), openAwardKind: flight.kind });
        if (saved.adDismissed) api.startFlight();
      } finally {
        preparing = false;
        api.releaseAwards();
      }
    };
    void consider().catch(() => undefined);
    const resume = subscribeAwardSurface(() => { void consider().catch(() => undefined); });
    const app = AppState.addEventListener('change', state => {
      if (state === 'active') void consider().catch(() => undefined);
    });
    return () => { cancelled = true; resume(); app.remove(); };
  }, []);
  return null;
}
