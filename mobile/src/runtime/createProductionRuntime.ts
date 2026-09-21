import * as Speech from 'expo-speech';
import {
  ExpoSpeechRecognitionModule,
} from 'expo-speech-recognition';
import { sharedTranslationEngine } from '../mt/TranslationEngine';
import { hardStopRecognition } from '../stt/sttSupport';
import type { RuntimePorts } from './ports';

/**
 * Production iOS adapters. Camera permission/capture stay on CameraScreen until
 * slice 4 wires the capture port to expo-camera; OCR already goes through this port.
 */
export function createProductionRuntime(): RuntimePorts {
  let idSeq = 0;
  const speechListeners = new Set<
    (event: {
      kind: 'result' | 'end' | 'error';
      transcript?: string;
      isFinal?: boolean;
      reason?: string;
    }) => void
  >();

  return {
    translation: {
      translate: (req) => sharedTranslationEngine.translate(req),
      cancelAll: () => sharedTranslationEngine.cancelAll(),
      isNeuralReady: () => sharedTranslationEngine.isNeuralReady(),
    },
    speechRecognition: {
      requestPermission: async () => {
        try {
          const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
          return result.granted ? 'granted' : 'denied';
        } catch {
          return 'denied';
        }
      },
      start: (opts) => {
        try {
          ExpoSpeechRecognitionModule.start({
            lang: opts.lang,
            interimResults: opts.interimResults ?? true,
            continuous: false,
          });
        } catch {
          for (const l of speechListeners) {
            l({ kind: 'error', reason: 'start_failed' });
          }
        }
      },
      stop: () => {
        try {
          ExpoSpeechRecognitionModule.stop();
        } catch {
          /* soft-fail */
        }
      },
      abort: () => {
        hardStopRecognition();
      },
      subscribe: (listener) => {
        speechListeners.add(listener);
        return () => {
          speechListeners.delete(listener);
        };
      },
    },
    speechSynthesis: {
      speak: (text, opts) => {
        Speech.speak(text, { language: opts.language, rate: opts.rate });
      },
      stop: () => {
        void Speech.stop();
      },
    },
    camera: {
      getPermission: async () => 'undetermined',
      requestPermission: async () => 'undetermined',
      takePicture: async () => null,
    },
    ocr: {
      recognize: async (uri) => {
        const mod = await import('neptranslate-ocr');
        return mod.recognizeText(uri);
      },
    },
    clock: {
      nowMs: () => Date.now(),
    },
    ids: {
      nextId: (prefix = 'id') => {
        idSeq += 1;
        return `${prefix}-${idSeq}`;
      },
    },
    connectivity: {
      isOffline: () => false,
      subscribe: () => () => undefined,
    },
  };
}
