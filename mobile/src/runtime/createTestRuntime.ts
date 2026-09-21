import type { OcrDocument } from '../camera/ocrTypes';
import type {
  CameraPermission,
  RuntimePorts,
  SpeechPermission,
  TranslateRequest,
  TranslateResult,
} from './ports';

export type RecordedTranslate = {
  match?: (req: TranslateRequest) => boolean;
  result: TranslateResult;
};

export type TestRuntimeOptions = {
  nowMs?: number;
  offline?: boolean;
  neuralReady?: boolean;
  speechPermission?: SpeechPermission;
  cameraPermission?: CameraPermission;
  transcripts?: string[];
  ocrDocuments?: Record<string, OcrDocument>;
  translations?: RecordedTranslate[];
  translateError?: string | null;
};

/** Deterministic adapters for Jest and the Windows testing ground. */
export function createTestRuntime(options: TestRuntimeOptions = {}): RuntimePorts & {
  setNowMs: (ms: number) => void;
  advanceMs: (ms: number) => void;
  pushTranscript: (text: string, isFinal?: boolean) => void;
  endSpeech: () => void;
  failSpeech: (reason: string) => void;
} {
  let nowMs = options.nowMs ?? 1_000_000;
  let idSeq = 0;
  let offline = options.offline ?? false;
  let speechPermission = options.speechPermission ?? 'granted';
  let cameraPermission = options.cameraPermission ?? 'granted';
  const translations = options.translations ?? [];
  const ocrDocuments = options.ocrDocuments ?? {};
  const speechListeners = new Set<
    (event: {
      kind: 'result' | 'end' | 'error';
      transcript?: string;
      isFinal?: boolean;
      reason?: string;
    }) => void
  >();
  const netListeners = new Set<(offline: boolean) => void>();

  const runtime: RuntimePorts & {
    setNowMs: (ms: number) => void;
    advanceMs: (ms: number) => void;
    pushTranscript: (text: string, isFinal?: boolean) => void;
    endSpeech: () => void;
    failSpeech: (reason: string) => void;
  } = {
    translation: {
      translate: async (req) => {
        if (options.translateError) {
          throw new Error(options.translateError);
        }
        const hit = translations.find((t) => (t.match ? t.match(req) : true));
        if (hit) return { ...hit.result };
        return {
          text: req.text ? `[${req.preferred}] ${req.text}` : '',
          method: 'lexicon',
          direction: req.preferred,
        };
      },
      cancelAll: () => undefined,
      isNeuralReady: () => options.neuralReady ?? false,
    },
    speechRecognition: {
      requestPermission: async () => speechPermission,
      start: () => undefined,
      stop: () => {
        for (const l of speechListeners) l({ kind: 'end' });
      },
      abort: () => {
        for (const l of speechListeners) l({ kind: 'end' });
      },
      subscribe: (listener) => {
        speechListeners.add(listener);
        return () => {
          speechListeners.delete(listener);
        };
      },
    },
    speechSynthesis: {
      speak: () => undefined,
      stop: () => undefined,
    },
    camera: {
      getPermission: async () => cameraPermission,
      requestPermission: async () => {
        return cameraPermission;
      },
      takePicture: async () => ({ uri: 'test://capture.jpg' }),
    },
    ocr: {
      recognize: async (uri) => {
        const doc = ocrDocuments[uri];
        if (!doc) {
          return {
            width: 800,
            height: 1200,
            rotation: 0,
            blocks: [],
          };
        }
        return doc;
      },
    },
    clock: {
      nowMs: () => nowMs,
    },
    ids: {
      nextId: (prefix = 'id') => {
        idSeq += 1;
        return `${prefix}-${idSeq}`;
      },
    },
    connectivity: {
      isOffline: () => offline,
      subscribe: (listener) => {
        netListeners.add(listener);
        return () => {
          netListeners.delete(listener);
        };
      },
    },
    setNowMs: (ms) => {
      nowMs = ms;
    },
    advanceMs: (ms) => {
      nowMs += ms;
    },
    pushTranscript: (text, isFinal = true) => {
      for (const l of speechListeners) {
        l({ kind: 'result', transcript: text, isFinal });
      }
    },
    endSpeech: () => {
      for (const l of speechListeners) l({ kind: 'end' });
    },
    failSpeech: (reason) => {
      for (const l of speechListeners) l({ kind: 'error', reason });
    },
  };

  return runtime;
}
