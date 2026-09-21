export type CaptureCleanupEvent = 'retake' | 'exit' | 'processed' | 'keep';

/** Temporary captures are deleted after retake, leaving Camera, or a finished translation. */
export function captureShouldBeDeleted(event: CaptureCleanupEvent): boolean {
  return event === 'retake' || event === 'exit' || event === 'processed';
}
