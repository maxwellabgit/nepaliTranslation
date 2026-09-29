import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '../features/auth/AuthProvider';
import {
  awardFlightMs,
  minutesForCredits,
  remainingMsUntil,
  stackAdFreeMinutes,
} from '../features/contribution/reviewCredits';
import { useEntitlement } from '../features/entitlements/EntitlementProvider';
import { getSupabase } from '../services/supabase';

export type CreditAwardPresentation = {
  credits: number;
  minutes: number;
  capped: boolean;
  fromRemainingMs: number;
  toRemainingMs: number;
};

type CreditClaimRow = {
  credits?: number;
  minutes_recorded?: number;
  minutes_applied?: number;
  capped?: boolean;
};

type Phase = 'idle' | 'message' | 'flying' | 'pump';

type CreditAwardValue = {
  phase: Phase;
  presentation: CreditAwardPresentation | null;
  /** While an award is on screen, the gauge shows this clock instead of the live one. */
  displayRemainingMs: number | null;
  collect: () => void;
};

const IDLE: CreditAwardValue = {
  phase: 'idle',
  presentation: null,
  displayRemainingMs: null,
  collect: () => undefined,
};

const CreditAwardContext = createContext<CreditAwardValue | null>(null);

export function presentCreditClaim(input: {
  nowMs: number;
  earnedUntilMs: number | null;
  credits: number;
  minutesApplied: number;
  capped: boolean;
}): CreditAwardPresentation {
  const beforeMinutes = remainingMsUntil(input.earnedUntilMs, input.nowMs) / 60_000;
  const stacked = stackAdFreeMinutes(beforeMinutes, input.minutesApplied);
  return {
    credits: input.credits,
    minutes: input.minutesApplied,
    capped: input.capped || stacked.capped,
    fromRemainingMs: beforeMinutes * 60_000,
    toRemainingMs: stacked.remainingMinutes * 60_000,
  };
}

async function claimPendingRewards(): Promise<CreditClaimRow | null> {
  const client = getSupabase();
  if (!client) return null;
  const { data, error } = await client.rpc('claim_pending_rewards');
  if (error || data == null || typeof data !== 'object') return null;
  return data as CreditClaimRow;
}

function usePump(fromMs: number, toMs: number, active: boolean, durationMs: number): number {
  const [value, setValue] = useState(fromMs);
  useEffect(() => {
    if (!active) {
      setValue(fromMs);
      return;
    }
    const started = Date.now();
    const duration = Math.max(400, durationMs);
    let frame = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - started) / duration);
      const eased = 1 - (1 - t) ** 3;
      setValue(fromMs + (toMs - fromMs) * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, durationMs, fromMs, toMs]);
  return value;
}

export function CreditAwardProvider({ children }: { children: ReactNode }) {
  const { status, userId } = useAuth();
  const entitlement = useEntitlement();
  const untilRef = useRef(entitlement.earnedAdFreeUntilMs);
  const refreshRef = useRef(entitlement.refresh);
  untilRef.current = entitlement.earnedAdFreeUntilMs;
  refreshRef.current = entitlement.refresh;
  const [phase, setPhase] = useState<Phase>('idle');
  const [presentation, setPresentation] = useState<CreditAwardPresentation | null>(null);
  const [pumpMs, setPumpMs] = useState(1100);
  const presentationRef = useRef(presentation);
  presentationRef.current = presentation;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const pumped = usePump(
    presentation?.fromRemainingMs ?? 0,
    presentation?.toRemainingMs ?? 0,
    phase === 'pump',
    pumpMs,
  );

  useEffect(() => {
    if (status !== 'signed-in' || !userId || !entitlement.ready) return;
    let cancel = false;
    const nowMs = Date.now();
    const beforeUntil = untilRef.current;
    void (async () => {
      try {
        const row = await claimPendingRewards();
        if (cancel) return;
        const credits = Number(row?.credits ?? 0);
        const minutesApplied = Number(row?.minutes_applied ?? 0);
        if (!Number.isFinite(credits) || credits <= 0) return;
        setPresentation(
          presentCreditClaim({
            nowMs,
            earnedUntilMs: beforeUntil,
            credits,
            minutesApplied: Number.isFinite(minutesApplied)
              ? minutesApplied
              : minutesForCredits(credits),
            capped: Boolean(row?.capped),
          }),
        );
        setPhase('message');
        await refreshRef.current();
      } catch {
        // An older server without the claim function leaves the timer unchanged.
      }
    })();
    return () => {
      cancel = true;
    };
  }, [status, userId, entitlement.ready]);

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
    },
    [],
  );

  const collect = useCallback(() => {
    const flight = awardFlightMs(presentationRef.current?.credits ?? 0);
    const pumpAt = 700;
    const doneAt = flight + 280;
    setPumpMs(Math.max(900, doneAt - pumpAt));
    setPhase((current) => (current === 'message' ? 'flying' : current));
    timers.current.forEach(clearTimeout);
    timers.current = [
      setTimeout(() => setPhase('pump'), pumpAt),
      setTimeout(() => {
        setPhase('idle');
        setPresentation(null);
      }, doneAt),
    ];
  }, []);

  const displayRemainingMs =
    phase === 'message' || phase === 'flying'
      ? (presentation?.fromRemainingMs ?? null)
      : phase === 'pump'
        ? pumped
        : null;

  const value = useMemo<CreditAwardValue>(
    () => ({
      phase,
      presentation,
      displayRemainingMs,
      collect,
    }),
    [phase, presentation, displayRemainingMs, collect],
  );

  return <CreditAwardContext.Provider value={value}>{children}</CreditAwardContext.Provider>;
}

export function useCreditAwardOptional(): CreditAwardValue {
  return useContext(CreditAwardContext) ?? IDLE;
}
