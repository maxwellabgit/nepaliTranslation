import type { TestingGroundBootConfig } from '../../src/bridge/types';
import { defaultBootConfig } from '../../src/bridge/config';

/**
 * Deterministic TG boot for Playwright against /hosted-app/.
 *
 * `acknowledgeStartupConsent` defaults to `'auto-accept'` here so every
 * scenario that uses `scenarioBoot(...)` bypasses the G2 startup gate
 * through a visible fixture value (per the R0 rule from the audit runbook:
 * a test may bypass the gate only through an explicit fixture named to
 * make the bypass visible). Scenarios that specifically exercise the
 * gate opt out by overriding this back to `'require'`.
 */
export function scenarioBoot(
  overrides: Partial<TestingGroundBootConfig> = {},
): TestingGroundBootConfig {
  return defaultBootConfig({
    translateMode: 'recorded',
    offline: true,
    neuralReady: false,
    speechPermission: 'granted',
    cameraPermission: 'granted',
    acknowledgeStartupConsent: 'auto-accept',
    ocrFixture: null,
    translations: [
      {
        source: 'Hello',
        preferred: 'en-ne',
        text: 'नमस्ते',
        method: 'recorded',
        direction: 'en-ne',
      },
      {
        source: 'नमस्ते',
        preferred: 'ne-en',
        text: 'Hello',
        method: 'recorded',
        direction: 'ne-en',
      },
    ],
    ...overrides,
  });
}
