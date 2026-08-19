import * as Speech from 'expo-speech';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { hardStopNepaliAsr } from './nepaliAsr';

/**
 * Capability detection + shared teardown for speech.
 *
 * Apple ships no Nepali speech recognizer and (on most devices) no Nepali
 * voice. English STT is probed fail-open (never hide the mic on a probe
 * error). Nepali STT is probed fail-closed — a probe error must not pretend
 * Apple can hear Nepali (that skips the typed fallback).
 */

export function hardStopRecognition(): void {
  try {
    const mod = ExpoSpeechRecognitionModule as {
      abort?: () => void;
      stop?: () => void;
    };
    if (typeof mod.abort === 'function') mod.abort();
    else if (typeof mod.stop === 'function') mod.stop();
  } catch {
    /* ignore */
  }
}

/** Stop Apple STT, Whisper Nepali ASR (no-op until linked), and TTS. */
export function hardStopSpeech(): void {
  hardStopRecognition();
  hardStopNepaliAsr();
  try {
    Speech.stop();
  } catch {
    /* ignore */
  }
}

export type SttSupport = {
  en: boolean;
  ne: boolean;
};

let sttPromise: Promise<SttSupport> | null = null;

function localesToSupport(locales: string[]): SttSupport {
  const all = locales.map((l) => l.toLowerCase());
  if (!all.length) return { en: true, ne: false };
  return {
    en: all.some((l) => l.startsWith('en')),
    ne: all.some((l) => l.startsWith('ne')),
  };
}

/** Cached once per app run. English fails open; Nepali fails closed. */
export function getSttSupport(): Promise<SttSupport> {
  if (!sttPromise) {
    sttPromise = (async () => {
      try {
        const mod = ExpoSpeechRecognitionModule as unknown as {
          getSupportedLocales?: (opts?: object) => Promise<{
            locales?: string[];
            installedLocales?: string[];
          }>;
        };
        if (typeof mod.getSupportedLocales !== 'function') {
          return { en: true, ne: false };
        }
        const res = await mod.getSupportedLocales({});
        return localesToSupport([
          ...(res.locales ?? []),
          ...(res.installedLocales ?? []),
        ]);
      } catch {
        return { en: true, ne: false };
      }
    })();
  }
  return sttPromise;
}

let neVoicePromise: Promise<boolean> | null = null;

/** True when the OS has a Nepali TTS voice installed. Cached per app run. */
export function hasNepaliVoice(): Promise<boolean> {
  if (!neVoicePromise) {
    neVoicePromise = (async () => {
      try {
        const voices = await Speech.getAvailableVoicesAsync();
        if (!voices?.length) return false;
        return voices.some((v) =>
          (v.language ?? '').toLowerCase().startsWith('ne'),
        );
      } catch {
        // Unknown — keep the control visible rather than hiding a working voice.
        return true;
      }
    })();
  }
  return neVoicePromise;
}
