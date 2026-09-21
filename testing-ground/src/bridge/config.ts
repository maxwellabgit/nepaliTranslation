import type { TestingGroundBootConfig, TranslateModeId } from './types';

export const TRANSLATE_MODE_LABELS: Record<
  TranslateModeId,
  { label: string; honesty: string }
> = {
  'fast-fallback': {
    label: 'fast fallback',
    honesty: 'Deterministic lexicon/echo path via createTestRuntime (no neural).',
  },
  recorded: {
    label: 'recorded',
    honesty: 'Returns fixture translations only; missing keys use a tagged echo.',
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
    translations: [
      {
        source: 'Hello',
        preferred: 'en-ne',
        text: 'नमस्ते',
        method: 'recorded',
        direction: 'en-ne',
      },
    ],
    transcripts: ['Hello'],
    seed: 'tg-seed-1',
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
