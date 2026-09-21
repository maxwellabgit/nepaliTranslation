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
 * English or Nepali STT is available.
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
 * Prefers `installedLocales` (on-device) when the probe returns any.
 */
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
          return { ...UNAVAILABLE };
        }
        const res = await mod.getSupportedLocales({});
        const installed = (res.installedLocales ?? []).map((l) =>
          l.toLowerCase(),
        );
        const supported = (res.locales ?? []).map((l) => l.toLowerCase());
        // Prefer installed (offline/on-device). Fall back to supported only when
        // installed list is present but we still need a probe signal — empty
        // installed with empty supported remains unavailable.
        const pool = installed.length > 0 ? installed : supported;
        if (!pool.length) return { ...UNAVAILABLE };
        return {
          en: pool.some((l) => l.startsWith('en')),
          ne: pool.some((l) => l.startsWith('ne')),
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
