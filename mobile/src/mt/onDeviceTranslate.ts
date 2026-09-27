/**
 * Direction choice and script display for the two IndicTrans2 checkpoints.
 * Translation itself is only in TranslationEngine via those checkpoints.
 */
import {
  companionNepaliScript,
  formatNepaliScript,
  looksLikeRomanNepali,
  romanToDevanagari,
} from './romanize';

export type Direction = 'en-ne' | 'ne-en';
export type Formality = 'formal' | 'informal';
/** Devanagari vs Roman Nepali for Nepali display. */
export type NepaliScript = 'deva' | 'roman';

const DEVANAGARI = /[\u0900-\u097F]/;

export function detectDirection(text: string, preferred: Direction): Direction {
  if (DEVANAGARI.test(text)) return 'ne-en';
  if (looksLikeRomanNepali(text)) return 'ne-en';
  if (/[a-zA-Z]/.test(text)) return 'en-ne';
  return preferred;
}

export type TranslateResult = {
  text: string;
  method: 'phrase' | 'lexicon' | 'neural';
  direction: Direction;
};

export type TranslateOptions = {
  formality?: Formality;
  /** Applied to Nepali output (EN→NE) after the checkpoint. */
  script?: NepaliScript;
  /**
   * Conversation mode: never auto-detect opposite language.
   * Trust the speaker side so EN↔NE switching stays stable.
   */
  forcePreferred?: boolean;
};

export function sourceLabel(direction: Direction): string {
  return direction === 'en-ne' ? 'English' : 'Nepali';
}

export function targetLabel(direction: Direction): string {
  return direction === 'en-ne' ? 'Nepali' : 'English';
}

export {
  companionNepaliScript,
  formatNepaliScript,
  looksLikeRomanNepali,
  romanToDevanagari,
};
