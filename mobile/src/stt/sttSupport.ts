import * as Speech from 'expo-speech';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

/**
 * Capability detection + shared teardown for speech.
 *
 * Apple ships no Nepali speech recognizer and (on most devices) no Nepali
 * voice, so both must be checked — never assumed — before offering
 * Nepali mic or speaker UI.
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

let sttPromise: Promise<SttSupport> | null = null;

/** Cached once per app run. Fails open so a probe error never hides the mic. */
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
          return { en: true, ne: true };
        }
        const res = await mod.getSupportedLocales({});
        const all = [...(res.locales ?? []), ...(res.installedLocales ?? [])].map(
          (l) => l.toLowerCase(),
        );
        if (!all.length) return { en: true, ne: true };
        return {
          en: all.some((l) => l.startsWith('en')),
          ne: all.some((l) => l.startsWith('ne')),
        };
      } catch {
        return { en: true, ne: true };
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
