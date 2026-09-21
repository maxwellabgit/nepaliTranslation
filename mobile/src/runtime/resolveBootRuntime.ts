/**
 * Native / default: no testing-ground boot config.
 * Web override: resolveBootRuntime.web.ts
 */
import type { RuntimePorts } from './ports';

export function resolveBootRuntime(): RuntimePorts | undefined {
  return undefined;
}
