/**
 * Device/runtime ports. Screens and session hooks call these contracts only.
 * Production iOS adapters and deterministic test/Windows adapters implement them.
 */
import type { Formality, NepaliScript } from '../mt/onDeviceTranslate';
import type { OcrDocument } from '../camera/ocrTypes';

export type TranslateDirection = 'en-ne' | 'ne-en';

export type TranslateRequest = {
  text: string;
  preferred: TranslateDirection;
  formality: Formality;
  script: NepaliScript;
  forcePreferred?: boolean;
};

export type TranslateResult = {
  text: string;
  method: string;
  direction: TranslateDirection;
  cancelled?: boolean;
};

export type TranslationPort = {
  translate: (req: TranslateRequest) => Promise<TranslateResult>;
  cancelAll: () => void;
  isNeuralReady: () => boolean;
};

export type SpeechPermission = 'granted' | 'denied' | 'undetermined';

export type SpeechRecognitionStartOpts = {
  lang: string;
  interimResults?: boolean;
  /**
   * Prefer on-device recognition. Production defaults this to true.
   * Fail closed when the locale is not installed for offline use.
   */
  requiresOnDeviceRecognition?: boolean;
};

export type SpeechRecognitionEvent = {
  kind: 'result' | 'end' | 'error';
  transcript?: string;
  isFinal?: boolean;
  reason?: string;
};

export type SpeechRecognitionPort = {
  requestPermission: () => Promise<SpeechPermission>;
  start: (opts: SpeechRecognitionStartOpts) => void;
  stop: () => void;
  abort: () => void;
  /** Subscribe to final/interim transcripts. Returns unsubscribe. */
  subscribe: (listener: (event: SpeechRecognitionEvent) => void) => () => void;
};

export type SpeechSynthesisPort = {
  speak: (text: string, opts: { language: string; rate?: number }) => void;
  stop: () => void;
};

export type CameraPermission = 'granted' | 'denied' | 'undetermined';

export type CameraCapturePort = {
  getPermission: () => Promise<CameraPermission>;
  requestPermission: () => Promise<CameraPermission>;
  takePicture: () => Promise<{ uri: string } | null>;
};

export type OcrPort = {
  recognize: (uri: string) => Promise<OcrDocument>;
};

export type ClockPort = {
  nowMs: () => number;
};

export type IdPort = {
  nextId: (prefix?: string) => string;
};

export type ConnectivityPort = {
  isOffline: () => boolean;
  subscribe: (listener: (offline: boolean) => void) => () => void;
};

export type RuntimePorts = {
  translation: TranslationPort;
  speechRecognition: SpeechRecognitionPort;
  speechSynthesis: SpeechSynthesisPort;
  camera: CameraCapturePort;
  ocr: OcrPort;
  clock: ClockPort;
  ids: IdPort;
  connectivity: ConnectivityPort;
};
