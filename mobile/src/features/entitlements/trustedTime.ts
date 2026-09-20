/**
 * Trusted server time. Device wall-clock changes must not mint ad-free time.
 * Advance only by monotonic elapsed since the last sync.
 */
export type TrustedClock = {
  serverNowAtSyncMs: number;
  deviceNowAtSyncMs: number;
  monoAtSyncMs: number;
};

export function measureServerOffset(
  deviceNowMs: number,
  serverNowMs: number,
  monoNowMs: number = deviceNowMs,
): TrustedClock {
  return {
    serverNowAtSyncMs: serverNowMs,
    deviceNowAtSyncMs: deviceNowMs,
    monoAtSyncMs: monoNowMs,
  };
}

/** Approximate server now using monotonic elapsed since sync. */
export function trustedNowMs(
  deviceNowMs: number,
  clock: TrustedClock | null,
  monoNowMs: number = deviceNowMs,
): number {
  if (!clock) return deviceNowMs;
  return clock.serverNowAtSyncMs + (monoNowMs - clock.monoAtSyncMs);
}

/**
 * Stacking rule: max(trustedNow, currentExpiry) + minutes.
 * Callers must pass trustedNowMs (monotonic-based), not raw skewed Date.now().
 */
export function stackAdFreeExpiry(input: {
  trustedNowMs: number;
  currentExpiryMs: number | null;
  minutes: number;
}): number {
  const base =
    input.currentExpiryMs !== null && input.currentExpiryMs > input.trustedNowMs
      ? input.currentExpiryMs
      : input.trustedNowMs;
  return base + input.minutes * 60_000;
}

/** Property helper: moving the device wall clock alone must not change stacked expiry. */
export function clockSkewCannotMint(input: {
  clock: TrustedClock;
  currentExpiryMs: number | null;
  minutes: number;
  skewMs: number;
  monoNowMs: number;
}): boolean {
  const a = stackAdFreeExpiry({
    trustedNowMs: trustedNowMs(
      input.clock.deviceNowAtSyncMs,
      input.clock,
      input.monoNowMs,
    ),
    currentExpiryMs: input.currentExpiryMs,
    minutes: input.minutes,
  });
  const skewedDevice = input.clock.deviceNowAtSyncMs + input.skewMs;
  const b = stackAdFreeExpiry({
    trustedNowMs: trustedNowMs(skewedDevice, input.clock, input.monoNowMs),
    currentExpiryMs: input.currentExpiryMs,
    minutes: input.minutes,
  });
  return a === b;
}
