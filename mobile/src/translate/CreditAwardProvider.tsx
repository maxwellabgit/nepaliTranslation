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
import {
  clearPendingFlight,
  extendDailyUntil,
  laterActiveUntil,
  readDailyOpen,
} from '../features/contribution/dailyOpen';
import { useEntitlement } from '../features/entitlements/EntitlementProvider';
import { getSupabase } from '../services/supabase';

export type CreditAwardPresentation = {
  credits: number;
  minutes: number;
  capped: boolean;
  fromRemainingMs: number;
  toRemainingMs: number;
  /** Set for the first-open and daily awards. Review claims use the default copy. */
  title?: string;
  body?: string;
  rewardName?: string;
};

type CreditClaimRow = {
  credits?: number;
  minutes_recorded?: number;
  minutes_applied?: number;
  capped?: boolean;
};

type Phase = 'idle' | 'message' | 'flying' | 'pump';

type QueuedAward =
  | { type: 'claim'; row: CreditClaimRow }
  | { type: 'ready'; presentation: CreditAwardPresentation };

type CreditAwardValue = {
  phase: Phase;
  presentation: CreditAwardPresentation | null;
  /** While an award is on screen, the gauge shows this clock instead of the live one. */
  displayRemainingMs: number | null;
  collect: () => void;
  /** Start the coin flight without a Collect press. Welcome and daily grants use this. */
  startFlight: () => void;
  /** Hold review claims until the post-signup popups close. */
  holdAwards: () => void;
  releaseAwards: () => void;
  /** Show this award immediately. A review claim already on screen waits behind it. */
  startAward: (presentation: CreditAwardPresentation) => void;
};

const IDLE: CreditAwardValue = {
  phase: 'idle',
  presentation: null,
  displayRemainingMs: null,
  collect: () => undefined,
  startFlight: () => undefined,
  holdAwards: () => undefined,
  releaseAwards: () => undefined,
  startAward: () => undefined,
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
  const held = useRef(false);
  const phaseRef = useRef<Phase>('idle');
  const queue = useRef<QueuedAward[]>([]);
  const pumped = usePump(
    presentation?.fromRemainingMs ?? 0,
    presentation?.toRemainingMs ?? 0,
    phase === 'pump',
    pumpMs,
  );

  const showReady = useCallback((next: CreditAwardPresentation) => {
    presentationRef.current = next;
    phaseRef.current = 'message';
    setPresentation(next);
    setPhase('message');
  }, []);

  const drainRef = useRef<() => void>(() => undefined);

  const showClaim = useCallback(async (row: CreditClaimRow) => {
    const credits = Number(row.credits ?? 0);
    const minutesApplied = Number(row.minutes_applied ?? 0);
    if (!Number.isFinite(credits) || credits <= 0) {
      drainRef.current();
      return;
    }
    phaseRef.current = 'message';
    try {
      const nowMs = Date.now();
      const daily = await readDailyOpen();
      const beforeUntil = laterActiveUntil(untilRef.current, daily?.untilMs, nowMs);
      const next = presentCreditClaim({
        nowMs,
        earnedUntilMs: beforeUntil,
        credits,
        minutesApplied: Number.isFinite(minutesApplied)
          ? minutesApplied
          : minutesForCredits(credits),
        capped: Boolean(row.capped),
      });
      await extendDailyUntil(nowMs + next.toRemainingMs);
      setPresentation(next);
      setPhase('message');
      await refreshRef.current();
    } catch {
      phaseRef.current = 'idle';
      setPhase('idle');
      setPresentation(null);
    }
  }, []);

  const drain = useCallback(() => {
    if (held.current || phaseRef.current !== 'idle') return;
    const next = queue.current.shift();
    if (!next) return;
    if (next.type === 'ready') {
      showReady(next.presentation);
      return;
    }
    void showClaim(next.row);
  }, [showClaim, showReady]);
  drainRef.current = drain;

  useEffect(() => {
    phaseRef.current = phase;
    if (phase === 'idle') drain();
  }, [drain, phase]);

  useEffect(() => {
    if (status !== 'signed-in' || !userId || !entitlement.ready) return;
    let cancel = false;
    void (async () => {
      try {
        const row = await claimPendingRewards();
        if (cancel || !row) return;
        const credits = Number(row.credits ?? 0);
        if (!Number.isFinite(credits) || credits <= 0) return;
        if (held.current || phaseRef.current !== 'idle') {
          queue.current.push({ type: 'claim', row });
          return;
        }
        await showClaim(row);
      } catch {
        // An older server without the claim function leaves the timer unchanged.
      }
    })();
    return () => {
      cancel = true;
    };
  }, [showClaim, status, userId, entitlement.ready]);

  const holdAwards = useCallback(() => {
    held.current = true;
  }, []);

  const releaseAwards = useCallback(() => {
    held.current = false;
    drain();
  }, [drain]);

  const startAward = useCallback(
    (next: CreditAwardPresentation) => {
      if (phaseRef.current !== 'idle') {
        queue.current.unshift({ type: 'ready', presentation: next });
        return;
      }
      showReady(next);
    },
    [showReady],
  );

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
    },
    [],
  );

  const startFlight = useCallback(() => {
    if (!presentationRef.current) return;
    if (phaseRef.current === 'flying' || phaseRef.current === 'pump') return;
    const flight = awardFlightMs(presentationRef.current.credits ?? 0);
    const pumpAt = 700;
    const doneAt = flight + 280;
    setPumpMs(Math.max(900, doneAt - pumpAt));
    phaseRef.current = 'flying';
    setPhase('flying');
    timers.current.forEach(clearTimeout);
    timers.current = [
      setTimeout(() => {
        phaseRef.current = 'pump';
        setPhase('pump');
      }, pumpAt),
      setTimeout(() => {
        phaseRef.current = 'idle';
        setPhase('idle');
        setPresentation(null);
        presentationRef.current = null;
        void clearPendingFlight();
      }, doneAt),
    ];
  }, []);

  const collect = useCallback(() => {
    if (phaseRef.current !== 'message') return;
    startFlight();
  }, [startFlight]);

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
      startFlight,
      holdAwards,
      releaseAwards,
      startAward,
    }),
    [
      phase,
      presentation,
      displayRemainingMs,
      collect,
      startFlight,
      holdAwards,
      releaseAwards,
      startAward,
    ],
  );

  return <CreditAwardContext.Provider value={value}>{children}</CreditAwardContext.Provider>;
}

export function useCreditAwardOptional(): CreditAwardValue {
  return useContext(CreditAwardContext) ?? IDLE;
}
