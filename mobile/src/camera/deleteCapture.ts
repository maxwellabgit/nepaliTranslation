import { File } from 'expo-file-system';
import { captureShouldBeDeleted, type CaptureCleanupEvent } from './cleanup';

/** Delete a temporary capture when the event is retake, exit, or successful processing. */
export function deleteCapture(uri: string | null, event: CaptureCleanupEvent): boolean {
  if (!uri || !captureShouldBeDeleted(event)) return false;
  try {
    new File(uri).delete();
    return true;
  } catch {
    return false;
  }
}
