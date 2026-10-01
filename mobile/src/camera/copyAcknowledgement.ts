export type ClipboardResult = boolean | 'error';

/**
 * The latest clipboard result owns the Copied label.
 * A false write or a rejection clears it. An older result must not clear a newer success.
 */
export function applyClipboardResult(input: {
  requestGeneration: number;
  currentGeneration: number;
  copied: ClipboardResult;
  id: string;
  visibleId: string | null;
}): { visibleId: string | null; startTimer: boolean } {
  if (input.requestGeneration !== input.currentGeneration) {
    return { visibleId: input.visibleId, startTimer: false };
  }
  if (input.copied !== true) {
    return { visibleId: null, startTimer: false };
  }
  return { visibleId: input.id, startTimer: true };
}
