import type { TestingGroundBootConfig, TranslateModeId } from './types';

export const TRANSLATE_MODE_LABELS: Record<
  TranslateModeId,
  { label: string; honesty: string }
> = {
  'fast-fallback': {
    label: 'fast fallback',
    honesty: 'No checkpoint in the browser. Unrecorded lines return empty.',
  },
  recorded: {
    label: 'recorded',
    honesty: 'Returns fixture translations only. Missing keys return empty.',
  },
  'local-neural': {
    label: 'local-neural',
    honesty:
      'Runs the pinned IndicTrans2 models locally in browser WASM. Loading is automatic; readiness requires successful model initialization. Native iOS performance is separate.',
  },
};

export function defaultBootConfig(
  overrides: Partial<TestingGroundBootConfig> = {},
): TestingGroundBootConfig {
  return {
    harness: 'neptranslate-testing-ground',
    translateMode: 'local-neural',
    offline: true,
    neuralReady: false,
    speechPermission: 'granted',
    cameraPermission: 'granted',
    transcripts: ['Hello'],
    featureFlags: {
      contributionTextEnabled: true,
    },
    seed: 'tg-seed-1',
    acknowledgeStartupConsent: 'auto-accept',
    ...overrides,
  };
}

export function applyTranslateMode(
  config: TestingGroundBootConfig,
  mode: TranslateModeId,
): TestingGroundBootConfig {
  if (mode === 'local-neural') {
    return { ...config, translateMode: mode, neuralReady: false };
  }
  if (mode === 'recorded') {
    return { ...config, translateMode: mode, neuralReady: false };
  }
  return { ...config, translateMode: mode, neuralReady: false };
}
