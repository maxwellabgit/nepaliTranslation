import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { File } from 'expo-file-system';

const MAX_PREVIEW_EDGE = 1280;

/**
 * Downsample a capture (max edge ~1280) then return an in-memory data URI
 * so the temporary file can be deleted after OCR / exit.
 */
export async function readCapturePreviewUri(uri: string): Promise<string | null> {
  try {
    let sourceUri = uri;
    try {
      const result = await manipulateAsync(
        uri,
        [{ resize: { width: MAX_PREVIEW_EDGE } }],
        { compress: 0.7, format: SaveFormat.JPEG },
      );
      sourceUri = result.uri;
    } catch {
      // Fall back to original capture if manipulator is unavailable.
      sourceUri = uri;
    }

    const base64 = await new File(sourceUri).base64();
    if (!base64) return null;
    const lower = sourceUri.toLowerCase();
    const mime = lower.endsWith('.png')
      ? 'image/png'
      : lower.endsWith('.webp')
        ? 'image/webp'
        : 'image/jpeg';
    return `data:${mime};base64,${base64}`;
  } catch {
    return null;
  }
}
