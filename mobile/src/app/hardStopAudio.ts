import * as Speech from 'expo-speech';
import { hardStopRecognition } from '../stt/sttSupport';
import { sharedTranslationEngine } from '../mt/TranslationEngine';

/** Stop STT, TTS, and in-flight MT. Call on tab switch and overlay open. */
export function hardStopAudio(): void {
  hardStopRecognition();
  try {
    Speech.stop();
  } catch {
    /* ignore */
  }
  sharedTranslationEngine.cancelAll();
}
