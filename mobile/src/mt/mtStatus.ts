/** Short traveler-facing MT / voice status (no filenames, no eng jargon). */
export function mtStatusLine(opts: {
  neuralReady: boolean;
  warmStatus?: string | null;
  listening?: boolean;
}): string {
  if (opts.listening) return 'Listening…';
  if (opts.warmStatus) return opts.warmStatus;
  if (opts.neuralReady) return 'EN→NE on-device · NE→EN phrases · voice via Apple';
  return 'Saved phrases · voice via Apple';
}

export const MT_WARM_PREPARING = 'Loading on-device model…';
export const MT_WARM_DOWNLOADING = 'Downloading translation model…';
export const MT_WARM_FAILED = 'Model unavailable · using phrases';
