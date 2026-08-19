/**
 * On-device speech playback.
 *
 * English always uses `en-US`. Nepali uses `ne-NP` only when the caller
 * knows a Nepali OS voice exists. Never substitute Hindi (`hi-IN`) or
 * English for Nepali — that mangles Devanagari. No cloud TTS.
 */
import * as Speech from 'expo-speech';

export function stopSpeech(): void {
  try {
    Speech.stop();
  } catch {
    /* ignore */
  }
}

export type SpeakUtteranceOpts = {
  lang: 'en' | 'ne';
  text: string;
  /** Required false to skip Nepali when the OS has no ne-* voice. */
  neVoiceOk?: boolean;
  rate?: number;
  onDone?: () => void;
  onStopped?: () => void;
  onError?: () => void;
};

/**
 * Speak `text`. Returns false when skipped (empty, or Nepali without a voice).
 */
export function speakUtterance(opts: SpeakUtteranceOpts): boolean {
  const text = opts.text.trim();
  if (!text) return false;
  if (opts.lang === 'ne' && opts.neVoiceOk === false) return false;
  stopSpeech();
  Speech.speak(text, {
    language: opts.lang === 'en' ? 'en-US' : 'ne-NP',
    rate: opts.rate ?? 0.95,
    onDone: opts.onDone,
    onStopped: opts.onStopped,
    onError: opts.onError,
  });
  return true;
}
