/**
 * Web: when `__NEPTRANSLATE_TG__` is set, use createTestServices so Playwright
 * can drive feature flags, offline/house ads, and IAP soft-fail without touching
 * the production iOS path.
 */
import type { FeatureFlags } from '../app/featureFlags';
import {
  createTestServices,
  type TestServicesOptions,
} from '../services/createTestServices';
import type { AppServices } from '../services/contracts';

type TgBoot = {
  harness?: string;
  offline?: boolean;
  featureFlags?: Partial<FeatureFlags>;
  /** Force purchase/restore to return unavailable (IAP soft-fail). */
  iapSoftFail?: boolean;
  authConfigured?: boolean;
  canRequestAds?: boolean;
};

function readTgBoot(): TgBoot | null {
  if (typeof window === 'undefined') return null;
  const boot = window.__NEPTRANSLATE_TG__ as TgBoot | undefined;
  if (!boot || boot.harness !== 'neptranslate-testing-ground') return null;
  return boot;
}

export function resolveBootServices(): AppServices | undefined {
  const boot = readTgBoot();
  if (!boot) return undefined;

  const options: TestServicesOptions = {
    offline: boot.offline ?? true,
    authConfigured: boot.authConfigured ?? false,
    flags: boot.featureFlags,
    canRequestAds: boot.canRequestAds ?? false,
    iapSoftFail: boot.iapSoftFail ?? false,
  };
  return createTestServices(options);
}
