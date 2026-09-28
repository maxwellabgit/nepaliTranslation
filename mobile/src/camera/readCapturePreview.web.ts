/**
 * Web preview of a local capture. Converts blob/http captures to a data URI
 * so the temporary file can be dropped without uploading the image.
 */
export async function readCapturePreviewUri(uri: string): Promise<string | null> {
  if (!uri) return null;
  if (uri.startsWith('data:')) return uri;
  try {
    const response = await fetch(uri);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') resolve(reader.result);
        else reject(new Error('preview_empty'));
      };
      reader.onerror = () => reject(reader.error ?? new Error('preview_failed'));
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
