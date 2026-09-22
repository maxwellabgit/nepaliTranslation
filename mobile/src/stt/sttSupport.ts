import * as Speech from 'expo-speech';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

/**
 * Capability detection + shared teardown for speech.
 *
 * Apple ships no Nepali speech recognizer and (on most devices) no Nepali
 * voice, so both must be checked — never assumed — before offering
 * Nepali mic or speaker UI.
 *
 * F1: fail closed. Missing / empty / throwing locale probes never claim
 * English or Nepali STT is available. Only `installedLocales` count as
 * on-device; cloud `locales` alone are insufficient.
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

export type SttSupport = {
  en: boolean;
  ne: boolean;
};

const UNAVAILABLE: SttSupport = { en: false, ne: false };

let sttPromise: Promise<SttSupport> | null = null;

/** Reset cached probe (unit tests only). */
export function resetSttSupportCache(): void {
  sttPromise = null;
}

/**
 * Cached once per app run. Fails closed: unknown / empty / error → both false.
 * Uses installedLocales only (on-device). Empty installed ⇒ unavailable.
 */
export function getSttSupport(): Promise<SttSupport> {
  if (!sttPromise) {
    sttPromise = (async () => {
      // Testing-ground web: pretend English on-device STT exists so permission /
      // deny paths are exercisable. Never claims native iOS STT parity.
      if (typeof window !== 'undefined') {
        const boot = (
          window as unknown as {
            __NEPTRANSLATE_TG__?: { harness?: string };
          }
        ).__NEPTRANSLATE_TG__;
        if (boot?.harness === 'neptranslate-testing-ground') {
          return { en: true, ne: false };
        }
      }
      try {
        const mod = ExpoSpeechRecognitionModule as unknown as {
          getSupportedLocales?: (opts?: object) => Promise<{
            locales?: string[];
            installedLocales?: string[];
          }>;
        };
        if (typeof mod.getSupportedLocales !== 'function') {
          return { ...UNAVAILABLE };
        }
        const res = await mod.getSupportedLocales({});
        const installed = (res.installedLocales ?? []).map((l) =>
          l.toLowerCase(),
        );
        if (!installed.length) return { ...UNAVAILABLE };
        return {
          en: installed.some((l) => l.startsWith('en')),
          ne: installed.some((l) => l.startsWith('ne')),
        };
      } catch {
        return { ...UNAVAILABLE };
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
