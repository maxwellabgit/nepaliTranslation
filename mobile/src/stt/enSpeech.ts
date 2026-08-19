/**
 * English Apple speech recognition.
 *
 * Prefer on-device (`requiresOnDeviceRecognition: true`) so airplane mode
 * can still hear English. If the OS has no on-device English recognizer,
 * fall back to network Apple once per session — never silently keep
 * failing on-device.
 *
 * Nepali is not handled here. Apple has no Nepali recognizer; that path
 * is `nepaliAsr.ts` (Whisper), not `lang: 'ne-NP'`.
 */
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';

export type EnglishSttMode = 'on-device' | 'network';

let preferOnDevice = true;
let probed = false;

function onDeviceSupported(): boolean {
  try {
    const mod = ExpoSpeechRecognitionModule as unknown as {
      supportsOnDeviceRecognition?: () => boolean;
    };
    if (typeof mod.supportsOnDeviceRecognition === 'function') {
      return !!mod.supportsOnDeviceRecognition();
    }
  } catch {
    /* probe failed — still try on-device once */
  }
  return true;
}

function ensureProbed(): void {
  if (probed) return;
  probed = true;
  if (!onDeviceSupported()) preferOnDevice = false;
}

export function englishSttMode(): EnglishSttMode {
  ensureProbed();
  return preferOnDevice ? 'on-device' : 'network';
}

export function englishOnDeviceSupported(): boolean {
  return onDeviceSupported();
}

/**
 * An English session errored. Next start uses network Apple.
 * Does not restart listening — the caller owns that.
 */
export function noteEnglishAsrError(): void {
  preferOnDevice = false;
}

export type EnglishAsrStartOpts = {
  continuous?: boolean;
  interimResults?: boolean;
};

export async function startEnglishAsr(
  opts: EnglishAsrStartOpts = {},
): Promise<void> {
  ensureProbed();
  const common = {
    lang: 'en-US' as const,
    interimResults: opts.interimResults ?? true,
    continuous: opts.continuous ?? false,
    addsPunctuation: true,
    requiresOnDeviceRecognition: preferOnDevice,
  };
  try {
    ExpoSpeechRecognitionModule.start(common);
  } catch {
    if (!preferOnDevice) throw new Error('English speech recognition failed');
    preferOnDevice = false;
    ExpoSpeechRecognitionModule.start({
      ...common,
      requiresOnDeviceRecognition: false,
    });
  }
}
