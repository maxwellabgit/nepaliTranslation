type Listener = () => void;

const reasons = new Set<string>();
const listeners = new Set<Listener>();

/** Recording, capture, or an in-flight translation. The welcome flight waits until this is clear. */
export function setAwardSurfaceBusy(reason: string, busy: boolean): void {
  if (!reason) return;
  if (busy) reasons.add(reason);
  else reasons.delete(reason);
  listeners.forEach((listener) => listener());
}

export function awardSurfaceIsBusy(): boolean {
  return reasons.size > 0;
}

export function subscribeAwardSurface(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function __resetAwardSurfaceForTests(): void {
  reasons.clear();
}
