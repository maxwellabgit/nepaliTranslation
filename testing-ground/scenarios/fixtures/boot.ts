import type { TestingGroundBootConfig } from '../../src/bridge/types';
import { defaultBootConfig } from '../../src/bridge/config';

/** Deterministic TG boot for Playwright against /hosted-app/. */
export function scenarioBoot(
  overrides: Partial<TestingGroundBootConfig> = {},
): TestingGroundBootConfig {
  return defaultBootConfig({
    translateMode: 'recorded',
    offline: true,
    neuralReady: false,
    speechPermission: 'granted',
    cameraPermission: 'granted',
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
