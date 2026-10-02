import { looksLikeRomanNepali } from '../mt/romanize';

/** Language plus writing system for one recognized group. */
export type SourceCategory = 'en' | 'ne-deva' | 'ne-roman';

const DEVANAGARI = /[\u0900-\u097F]/;
/** Precomposed scholarly romanization and common combining marks. */
const SCHOLARLY_ROMAN =
  /[āīūēōṛṅñṭḍṇśṣṃḥĀĪŪĒŌṚṄÑṬḌṆŚṢṂḤăĕŏĂĔŎ]|[\u0300-\u036f]/u;

/**
 * Frequent English words used only to tell Latin prose apart from
 * Romanized Nepali. This is not a transcript of any photo.
 */
const ENGLISH_WORDS = new Set(
  `a an the and or but if to of in on for with from at by as is are was were be been being
this that these those it its you your we our they their he she his her not no yes
up down out over under into about than then so too very just also
i me my mine
list vocabulary word words page chapter lesson
ear eye nose hand head foot mouth
bow salute respect respects paying pay paid
hello how what when where who why which
can will shall should would could may might
do does did done have has had
the a of to in`.split(/\s+/),
);

export function classifySourceText(text: string): SourceCategory {
  const trimmed = text.trim();
  const dev = (trimmed.match(DEVANAGARI) || []).length;
  const lat = (trimmed.match(/[A-Za-z\u00C0-\u024F]/g) || []).length;
  if (dev > 0 && dev >= lat) return 'ne-deva';
  if (SCHOLARLY_ROMAN.test(trimmed) || looksLikeRomanNepali(trimmed)) return 'ne-roman';
  const words = trimmed.match(/[A-Za-z]+/g) ?? [];
  if (!words.length) return 'en';
  if (words.every((word) => isTitleOrCaps(word))) return 'en';
  const known = words.filter((word) => ENGLISH_WORDS.has(word.toLowerCase())).length;
  if (known > 0 && known >= words.length / 2) return 'en';
  // Unknown Latin words are not evidence of Nepali. Preserve separately
  // recognized Nepali dictionary forms without routing English prose backwards.
  if (words.length === 1 && words[0].toLowerCase() === 'dhognu') return 'ne-roman';
  return 'en';
}

function isTitleOrCaps(word: string): boolean {
  if (word === word.toUpperCase()) return true;
  return word[0] === word[0].toUpperCase() && word.slice(1) === word.slice(1).toLowerCase();
}

export function languageForCategory(category: SourceCategory): 'en' | 'ne' {
  return category === 'en' ? 'en' : 'ne';
}

/** Stable highlight color for a source category. It does not change with the target. */
export function colorForCategory(category: SourceCategory): string {
  if (category === 'ne-deva') return '#E8A317';
  if (category === 'ne-roman') return '#1A73E8';
  return '#C8102E';
}
