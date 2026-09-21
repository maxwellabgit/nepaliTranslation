import { Image } from 'react-native';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { File } from 'expo-file-system';

const MAX_PREVIEW_EDGE = 1280;

function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (err) => reject(err),
    );
  });
}

/**
 * Downsample a capture (max edge ~1280) then return an in-memory data URI
 * so the temporary file can be deleted after OCR / exit.
 */
export async function readCapturePreviewUri(uri: string): Promise<string | null> {
  try {
    let sourceUri = uri;
    try {
      const { width, height } = await getImageSize(uri);
      const longEdge = Math.max(width, height);
      const actions =
        longEdge > MAX_PREVIEW_EDGE
          ? width >= height
            ? [{ resize: { width: MAX_PREVIEW_EDGE } }]
            : [{ resize: { height: MAX_PREVIEW_EDGE } }]
          : [];
      const result = await manipulateAsync(uri, actions, {
        compress: 0.7,
        format: SaveFormat.JPEG,
      });
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
