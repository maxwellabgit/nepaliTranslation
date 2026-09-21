import type { CameraPhase } from './machines/cameraPhase';
import { isCameraBusy } from './machines/cameraPhase';
import type { TranslatePhase } from './machines/translatePhase';
import { isTranslateBusy } from './machines/translatePhase';

export type IdleSnapshot = {
  translatePhase: TranslatePhase;
  cameraPhase: CameraPhase;
  listening: boolean;
  translating: boolean;
};

export function isRuntimeIdle(snapshot: IdleSnapshot): boolean {
  if (snapshot.listening || snapshot.translating) return false;
  if (isTranslateBusy(snapshot.translatePhase)) return false;
  if (isCameraBusy(snapshot.cameraPhase)) return false;
  return true;
}

/**
 * Poll until the runtime is idle. Automation must use this instead of fixed sleeps.
 * Deterministic when the clock and state updates are driven by the test harness.
 */
export async function waitForIdle(
  read: () => IdleSnapshot,
  opts: {
    timeoutMs: number;
    intervalMs?: number;
    nowMs: () => number;
    sleep?: (ms: number) => Promise<void>;
  },
): Promise<void> {
  const interval = opts.intervalMs ?? 16;
  const sleep =
    opts.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const start = opts.nowMs();
  while (!isRuntimeIdle(read())) {
    if (opts.nowMs() - start > opts.timeoutMs) {
      throw new Error('waitForIdle timed out');
    }
    await sleep(interval);
  }
}
