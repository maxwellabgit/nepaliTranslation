/**
 * Nepali speech input adapter.
 *
 * Apple has no Nepali recognizer. The product path is whisper.rn +
 * `Dragneel/whisper-small-nepali` ggml q5_1 (`ggml-ne-small-q5_1.bin`).
 *
 * This module is the only place Home/Conversation should ask "can we hear
 * Nepali?" — never `expo-speech-recognition` with `lang: 'ne-NP'`.
 *
 * whisper.rn is intentionally **not** in package.json on this branch:
 * it is a native module (EAS rebuild, no Expo Go). This cloud VM cannot
 * prove device ASR. `isNepaliAsrReady()` stays false until both the native
 * module is linked and the ggml file is on device.
 */
import { Directory, File, Paths } from 'expo-file-system';

export const NEPALI_WHISPER_FILENAME = 'ggml-ne-small-q5_1.bin';

export type NepaliAsrStatus = 'ready' | 'weights-only' | 'unbundled';

function nativeWhisperLinked(): boolean {
  // Do not `import('whisper.rn')` — Metro would fail the bundle while the
  // package is absent. Flip this when whisper.rn is a real dependency.
  return false;
}

function whisperWeightsPresent(): boolean {
  try {
    const roots = [
      new Directory(Paths.bundle, 'models', 'whisper'),
      new Directory(Paths.document, 'models', 'whisper'),
    ];
    for (const dir of roots) {
      const f = new File(dir, NEPALI_WHISPER_FILENAME);
      if (f.exists && (f.size ?? 0) > 0) return true;
    }
  } catch {
    /* missing Paths / file API */
  }
  return false;
}

export function nepaliAsrStatus(): NepaliAsrStatus {
  const weights = whisperWeightsPresent();
  const native = nativeWhisperLinked();
  if (native && weights) return 'ready';
  if (weights) return 'weights-only';
  return 'unbundled';
}

/** True only when live Nepali mic can actually start. */
export async function isNepaliAsrReady(): Promise<boolean> {
  return nepaliAsrStatus() === 'ready';
}

export async function startNepaliAsr(): Promise<void> {
  const status = nepaliAsrStatus();
  if (status !== 'ready') {
    throw new Error(
      status === 'weights-only'
        ? 'Nepali Whisper weights are present but whisper.rn is not linked'
        : 'Nepali Whisper model is not in this install',
    );
  }
  throw new Error('Nepali ASR native start is not wired in this build');
}

export function hardStopNepaliAsr(): void {
  /* no-op until whisper.rn is linked */
}
