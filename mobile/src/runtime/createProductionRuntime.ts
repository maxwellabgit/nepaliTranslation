import * as Speech from 'expo-speech';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { hardStopRecognition } from '../stt/sttSupport';
import { sharedTranslationEngine } from '../mt/TranslationEngine';
import { enqueueEligibleSpeechRecording } from '../services/mediaEnqueue';
import { readPublicEnv } from '../config/env';
import { getSupabase } from '../services/supabase';
import type { RuntimePorts, SpeechRecognitionEvent } from './ports';

/**
 * Production iOS adapters. CameraScreen still owns expo-camera permission/capture UI;
 * OCR + translation go through these ports (slice 4 / F1).
 */
export function createProductionRuntime(): RuntimePorts {
  let idSeq = 0;
  const speechListeners = new Set<(event: SpeechRecognitionEvent) => void>();

  const emitSpeech = (event: SpeechRecognitionEvent) => {
    for (const listener of speechListeners) listener(event);
  };

  // Wire native expo-speech-recognition events into the port once per runtime.
  const nativeSubs = [
    ExpoSpeechRecognitionModule.addListener('result', (event) => {
      emitSpeech({
        kind: 'result',
        transcript: event.results[0]?.transcript,
        isFinal: event.isFinal,
      });
    }),
    ExpoSpeechRecognitionModule.addListener('end', () => {
      emitSpeech({ kind: 'end' });
    }),
    ExpoSpeechRecognitionModule.addListener('audioend', (event) => {
      const uri = event?.uri;
      if (!uri) return;
      void (async () => {
        try {
          const env = readPublicEnv();
          const supabase = getSupabase();
          const session = supabase ? await supabase.auth.getSession() : null;
          await enqueueEligibleSpeechRecording({
            sourceUri: uri,
            signedIn: Boolean(session?.data.session?.user),
            authConfigured: env.authConfigured,
            userId: session?.data.session?.user?.id ?? null,
          });
        } catch {
          /* recognition must not depend on the upload */
        }
      })();
    }),
    ExpoSpeechRecognitionModule.addListener('error', (event) => {
      emitSpeech({ kind: 'error', reason: event.error ?? 'stt_error' });
    }),
  ];
  void nativeSubs;

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
            requiresOnDeviceRecognition: opts.requiresOnDeviceRecognition ?? true,
            recordingOptions: { persist: true },
          });
        } catch {
          emitSpeech({ kind: 'error', reason: 'start_failed' });
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
