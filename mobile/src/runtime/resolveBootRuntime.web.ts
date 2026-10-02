/**
 * Web: read window.__NEPTRANSLATE_TG__ (testing-ground host) and build
 * real local models by default, or explicit deterministic fixture adapters.
 * Product iOS path is untouched.
 */
import { setCameraTestFixture, setTestingGroundCaptureUri } from '../camera/testFixture';
import { INSCRIPTION_FIXTURE } from '../camera/inscriptionFixture';
import type { OcrDocument } from '../camera/ocrTypes';
import { sharedTranslationEngine } from '../mt/TranslationEngine';
import { createTestRuntime, type TestRuntimeOptions } from './createTestRuntime';
import type { RuntimePorts, TranslateRequest } from './ports';

type TgFixture = {
  source?: string;
  preferred?: 'en-ne' | 'ne-en';
  text: string;
  method?: string;
  direction?: 'en-ne' | 'ne-en';
};

type TgBoot = {
  harness?: string;
  translateMode?: 'fast-fallback' | 'recorded' | 'local-neural';
  offline?: boolean;
  neuralReady?: boolean;
  speechPermission?: TestRuntimeOptions['speechPermission'];
  cameraPermission?: TestRuntimeOptions['cameraPermission'];
  translations?: TgFixture[];
  transcripts?: string[];
  /** Jest/TG-only OCR fixture. `'inscription'` loads the bundled inscription sample. */
  ocrFixture?: OcrDocument | 'inscription' | null;
  /** Unchanged photo URL for the real post-capture pipeline. Not an OCR answer. */
  captureSource?: string | null;
};

function readTgBoot(): TgBoot | null {
  if (typeof window === 'undefined') return null;
  const boot = window.__NEPTRANSLATE_TG__;
  if (!boot || boot.harness !== 'neptranslate-testing-ground') return null;
  return boot;
}

function applyOcrFixture(boot: TgBoot): void {
  if (boot.ocrFixture === undefined) return;
  if (boot.ocrFixture === null) {
    setCameraTestFixture(null);
    return;
  }
  if (boot.ocrFixture === 'inscription') {
    setCameraTestFixture(INSCRIPTION_FIXTURE);
    return;
  }
  setCameraTestFixture(boot.ocrFixture);
}

export function resolveBootRuntime(): RuntimePorts | undefined {
  const boot = readTgBoot();
  if (!boot) return undefined;

  applyOcrFixture(boot);
  setTestingGroundCaptureUri(boot.captureSource ?? null);

  const mode = boot.translateMode ?? 'fast-fallback';
  const translations = (boot.translations ?? []).map((fixture) => ({
    match: (req: TranslateRequest) => {
      if (fixture.source != null && fixture.source !== req.text) return false;
      if (fixture.preferred != null && fixture.preferred !== req.preferred) {
        return false;
      }
      return true;
    },
    result: {
      text: fixture.text,
      method: fixture.method ?? (mode === 'recorded' ? 'recorded' : 'lexicon'),
      direction: fixture.direction ?? fixture.preferred ?? ('en-ne' as const),
    },
  }));

  const neuralReady = false;

  const runtime = createTestRuntime({
    offline: boot.offline ?? true,
    neuralReady,
    speechPermission: boot.speechPermission ?? 'granted',
    cameraPermission: boot.cameraPermission ?? 'granted',
    transcripts: boot.transcripts,
    translations,
    recognizeCapturedPhoto: true,
  });
  if (mode === 'local-neural') {
    const loading = sharedTranslationEngine.warmUp();
    runtime.translation = {
      translate: async req => { await loading; return sharedTranslationEngine.translate(req); },
      cancelAll: () => sharedTranslationEngine.cancelAll(),
      isNeuralReady: () => sharedTranslationEngine.isNeuralReady(),
    };
  }
  return runtime;
}

declare global {
  interface Window {
    __NEPTRANSLATE_TG__?: TgBoot & { harness?: string };
  }
}
