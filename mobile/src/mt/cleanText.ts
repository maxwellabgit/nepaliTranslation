/**
 * Drop stray symbols before on-device translation.
 * Sentence punctuation, letters, numbers, and Devanagari stay.
 * "Who are you?>" becomes "Who are you?" so a trailing marker cannot
 * hide an otherwise known sentence.
 */
export function cleanTranslationText(text: string): string {
  return (text || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/[^\p{L}\p{M}\p{N}\u0900-\u097F?.!,;:'"“”‘’\-–—…]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
