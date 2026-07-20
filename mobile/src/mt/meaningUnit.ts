/**
 * Meaning-centric translation unit (canonical training / review schema).
 * One meaning → formal/informal Devanagari; Roman derived for display.
 */
export type MeaningUnit = {
  meaning_id: string;
  english: string;
  ne_formal: string;
  ne_informal: string;
  roman_formal: string;
  roman_informal: string;
  surface?: string;
  provenance?: string;
};

export type FormalityControl = 'formal' | 'informal';
