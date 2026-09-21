/** Shared bridge contract between the testing-ground host and the Expo web export. */

export type TranslateModeId = 'fast-fallback' | 'recorded' | 'local-neural';

export type ViewportPresetId =
  | '375x812'
  | '390x844'
  | '430x932'
  | '768x1024'
  | '1024x1366';

export type ViewportPreset = {
  id: ViewportPresetId;
  label: string;
  width: number;
  height: number;
};

export const VIEWPORT_PRESETS: ViewportPreset[] = [
  { id: '375x812', label: 'iPhone SE / mini-ish', width: 375, height: 812 },
  { id: '390x844', label: 'iPhone 14', width: 390, height: 844 },
  { id: '430x932', label: 'iPhone 15 Pro Max', width: 430, height: 932 },
  { id: '768x1024', label: 'iPad portrait', width: 768, height: 1024 },
];

export type RecordedTranslateFixture = {
  /** Exact source text match when set; otherwise first entry wins. */
  source?: string;
  preferred?: 'en-ne' | 'ne-en';
  text: string;
  method?: string;
  direction?: 'en-ne' | 'ne-en';
};

/** Minimal OCR document shape shared with mobile `OcrDocument` (TG → web boot). */
export type TgOcrDocument = {
  width: number;
  height: number;
  rotation?: 0 | 90 | 180 | 270;
  blocks: Array<{
    text: string;
    language?: string;
    confidence?: number | null;
    frame: { x: number; y: number; width: number; height: number };
    cornerPoints?: Array<{ x: number; y: number }>;
    lines?: Array<{
      text: string;
      confidence?: number | null;
      frame: { x: number; y: number; width: number; height: number };
      cornerPoints?: Array<{ x: number; y: number }>;
    }>;
  }>;
};

export type TestingGroundBootConfig = {
  /** Eng-only marker so the hosted app knows it is not App Store product mode. */
  harness: 'neptranslate-testing-ground';
  translateMode: TranslateModeId;
  offline?: boolean;
  neuralReady?: boolean;
  speechPermission?: 'granted' | 'denied' | 'undetermined';
  cameraPermission?: 'granted' | 'denied' | 'undetermined';
  translations?: RecordedTranslateFixture[];
  transcripts?: string[];
  /**
   * Jest/TG camera fixture only. `'inscription'` uses the bundled sample.
   * Not native ML Kit parity on Windows.
   */
  ocrFixture?: TgOcrDocument | 'inscription' | null;
  seed?: string;
  runId?: string;
};

export type TimelineEvent = {
  at: string;
  kind: string;
  detail?: string;
};

export type HostCommand =
  | { type: 'tg-config'; payload: TestingGroundBootConfig }
  | { type: 'tg-command'; command: ScenarioCommandId; args?: Record<string, unknown> };

export type ScenarioCommandId =
  | 'load'
  | 'step'
  | 'run'
  | 'cancel'
  | 'reset'
  | 'seed'
  | 'export';

export type ScenarioState = {
  name: string;
  status: 'idle' | 'loaded' | 'running' | 'stepping' | 'cancelled' | 'done' | 'error';
  stepIndex: number;
  seed: string;
};

declare global {
  interface Window {
    /** Host publishes boot config for same-origin iframe children. */
    __NEPTRANSLATE_TG_HOST__?: {
      getBootConfig: () => TestingGroundBootConfig;
    };
    /** Hosted Expo web app reads this before React mounts (injected + host). */
    __NEPTRANSLATE_TG__?: TestingGroundBootConfig;
  }
}

export {};
