/**
 * Native: no testing-ground services injection.
 */
import type { AppServices } from '../services/contracts';

export function resolveBootServices(): AppServices | undefined {
  return undefined;
}
