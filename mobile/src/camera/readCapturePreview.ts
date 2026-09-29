import { Image } from 'react-native';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { File } from 'expo-file-system';
import { deleteCapture } from './deleteCapture';

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
 * Downsample a capture (max edge ~1280) then return an in-memory data URI.
 * The resized file is a second temporary capture and is deleted here.
 * The shutter file stays until retake, exit, or a finished read.
 */
export async function readCapturePreviewUri(uri: string): Promise<string | null> {
  let derived: string | null = null;
  try {
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
      if (result.uri && result.uri !== uri) derived = result.uri;
    } catch {
      derived = null;
    }

    const sourceUri = derived ?? uri;
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
  } finally {
    if (derived) deleteCapture(derived, 'processed');
  }
}
