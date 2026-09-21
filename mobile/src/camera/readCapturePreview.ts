import { File } from 'expo-file-system';

/** Read a capture into an in-memory data URI so the file can be deleted after OCR. */
export async function readCapturePreviewUri(uri: string): Promise<string | null> {
  try {
    const base64 = await new File(uri).base64();
    if (!base64) return null;
    const lower = uri.toLowerCase();
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
