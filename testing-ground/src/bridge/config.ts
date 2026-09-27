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
      'Stub on Windows testing ground — does not claim IndicTrans2 / native iOS parity. Marks neuralReady when configured; decode still uses the test adapter unless a future bridge wires real WASM/ONNX.',
  },
};

export function defaultBootConfig(
  overrides: Partial<TestingGroundBootConfig> = {},
): TestingGroundBootConfig {
  return {
    harness: 'neptranslate-testing-ground',
    translateMode: 'fast-fallback',
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
    return { ...config, translateMode: mode, neuralReady: true };
  }
  if (mode === 'recorded') {
    return { ...config, translateMode: mode, neuralReady: false };
  }
  return { ...config, translateMode: mode, neuralReady: false };
}
