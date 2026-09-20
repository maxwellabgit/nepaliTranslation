/**
 * Bundled Nepali alphabet for the offline Learn tab.
 * Content is instructional scaffold — bilingual sign-off is a human gate.
 */

export type AlphabetSectionId = 'vowels' | 'consonants' | 'conjuncts';

export type AlphabetGlyph = {
  id: string;
  dewanagari: string;
  roman: string;
  nameEn: string;
};

export type AlphabetSection = {
  id: AlphabetSectionId;
  titleEn: string;
  titleNe: string;
  glyphs: AlphabetGlyph[];
};

export const ALPHABET_SECTIONS: AlphabetSection[] = [
  {
    id: 'vowels',
    titleEn: 'Vowels',
    titleNe: 'स्वर',
    glyphs: [
      { id: 'a', dewanagari: 'अ', roman: 'a', nameEn: 'a' },
      { id: 'aa', dewanagari: 'आ', roman: 'aa', nameEn: 'aa' },
      { id: 'i', dewanagari: 'इ', roman: 'i', nameEn: 'i' },
      { id: 'ii', dewanagari: 'ई', roman: 'ii', nameEn: 'ii' },
      { id: 'u', dewanagari: 'उ', roman: 'u', nameEn: 'u' },
      { id: 'uu', dewanagari: 'ऊ', roman: 'uu', nameEn: 'uu' },
      { id: 'e', dewanagari: 'ए', roman: 'e', nameEn: 'e' },
      { id: 'ai', dewanagari: 'ऐ', roman: 'ai', nameEn: 'ai' },
      { id: 'o', dewanagari: 'ओ', roman: 'o', nameEn: 'o' },
      { id: 'au', dewanagari: 'औ', roman: 'au', nameEn: 'au' },
      { id: 'am', dewanagari: 'अं', roman: 'am', nameEn: 'am' },
      { id: 'ah', dewanagari: 'अः', roman: 'ah', nameEn: 'ah' },
    ],
  },
  {
    id: 'consonants',
    titleEn: 'Consonants',
    titleNe: 'व्यंजन',
    glyphs: [
      { id: 'ka', dewanagari: 'क', roman: 'ka', nameEn: 'ka' },
      { id: 'kha', dewanagari: 'ख', roman: 'kha', nameEn: 'kha' },
      { id: 'ga', dewanagari: 'ग', roman: 'ga', nameEn: 'ga' },
      { id: 'gha', dewanagari: 'घ', roman: 'gha', nameEn: 'gha' },
      { id: 'nga', dewanagari: 'ङ', roman: 'nga', nameEn: 'nga' },
      { id: 'cha', dewanagari: 'च', roman: 'cha', nameEn: 'cha' },
      { id: 'chha', dewanagari: 'छ', roman: 'chha', nameEn: 'chha' },
      { id: 'ja', dewanagari: 'ज', roman: 'ja', nameEn: 'ja' },
      { id: 'jha', dewanagari: 'झ', roman: 'jha', nameEn: 'jha' },
      { id: 'nya', dewanagari: 'ञ', roman: 'nya', nameEn: 'nya' },
      { id: 'ta', dewanagari: 'ट', roman: 'ta', nameEn: 'ṭa' },
      { id: 'tha', dewanagari: 'ठ', roman: 'tha', nameEn: 'ṭha' },
      { id: 'da', dewanagari: 'ड', roman: 'da', nameEn: 'ḍa' },
      { id: 'dha', dewanagari: 'ढ', roman: 'dha', nameEn: 'ḍha' },
      { id: 'na', dewanagari: 'ण', roman: 'na', nameEn: 'ṇa' },
      { id: 'ta2', dewanagari: 'त', roman: 'ta', nameEn: 'ta' },
      { id: 'tha2', dewanagari: 'थ', roman: 'tha', nameEn: 'tha' },
      { id: 'da2', dewanagari: 'द', roman: 'da', nameEn: 'da' },
      { id: 'dha2', dewanagari: 'ध', roman: 'dha', nameEn: 'dha' },
      { id: 'na2', dewanagari: 'न', roman: 'na', nameEn: 'na' },
      { id: 'pa', dewanagari: 'प', roman: 'pa', nameEn: 'pa' },
      { id: 'pha', dewanagari: 'फ', roman: 'pha', nameEn: 'pha' },
      { id: 'ba', dewanagari: 'ब', roman: 'ba', nameEn: 'ba' },
      { id: 'bha', dewanagari: 'भ', roman: 'bha', nameEn: 'bha' },
      { id: 'ma', dewanagari: 'म', roman: 'ma', nameEn: 'ma' },
      { id: 'ya', dewanagari: 'य', roman: 'ya', nameEn: 'ya' },
      { id: 'ra', dewanagari: 'र', roman: 'ra', nameEn: 'ra' },
      { id: 'la', dewanagari: 'ल', roman: 'la', nameEn: 'la' },
      { id: 'wa', dewanagari: 'व', roman: 'wa', nameEn: 'wa' },
      { id: 'sha', dewanagari: 'श', roman: 'sha', nameEn: 'sha' },
      { id: 'ssa', dewanagari: 'ष', roman: 'ssa', nameEn: 'ṣa' },
      { id: 'sa', dewanagari: 'स', roman: 'sa', nameEn: 'sa' },
      { id: 'ha', dewanagari: 'ह', roman: 'ha', nameEn: 'ha' },
    ],
  },
  {
    id: 'conjuncts',
    titleEn: 'Common conjuncts',
    titleNe: 'संयुक्त अक्षर',
    glyphs: [
      { id: 'ksha', dewanagari: 'क्ष', roman: 'ksha', nameEn: 'ksha' },
      { id: 'tra', dewanagari: 'त्र', roman: 'tra', nameEn: 'tra' },
      { id: 'gya', dewanagari: 'ज्ञ', roman: 'gya', nameEn: 'gya' },
      { id: 'shra', dewanagari: 'श्र', roman: 'shra', nameEn: 'shra' },
      { id: 'dwa', dewanagari: 'द्व', roman: 'dwa', nameEn: 'dwa' },
      { id: 'tta', dewanagari: 'त्त', roman: 'tta', nameEn: 'tta' },
      { id: 'nna', dewanagari: 'न्न', roman: 'nna', nameEn: 'nna' },
      { id: 'mma', dewanagari: 'म्म', roman: 'mma', nameEn: 'mma' },
    ],
  },
];

export type LessonPosition = {
  sectionId: AlphabetSectionId;
  glyphIndex: number;
};

export const DEFAULT_LESSON_POSITION: LessonPosition = {
  sectionId: 'vowels',
  glyphIndex: 0,
};

export function sectionById(id: AlphabetSectionId): AlphabetSection {
  const found = ALPHABET_SECTIONS.find((s) => s.id === id);
  if (!found) throw new Error(`unknown section ${id}`);
  return found;
}

export function clampLessonPosition(pos: LessonPosition): LessonPosition {
  const section = sectionById(pos.sectionId);
  const max = Math.max(0, section.glyphs.length - 1);
  return {
    sectionId: pos.sectionId,
    glyphIndex: Math.min(Math.max(0, pos.glyphIndex), max),
  };
}

export function advanceLesson(pos: LessonPosition): LessonSectionAdvance {
  const clamped = clampLessonPosition(pos);
  const section = sectionById(clamped.sectionId);
  if (clamped.glyphIndex + 1 < section.glyphs.length) {
    return {
      kind: 'glyph',
      position: { sectionId: clamped.sectionId, glyphIndex: clamped.glyphIndex + 1 },
    };
  }
  const idx = ALPHABET_SECTIONS.findIndex((s) => s.id === clamped.sectionId);
  if (idx >= 0 && idx + 1 < ALPHABET_SECTIONS.length) {
    return {
      kind: 'section',
      position: { sectionId: ALPHABET_SECTIONS[idx + 1].id, glyphIndex: 0 },
    };
  }
  return { kind: 'complete', position: clamped };
}

export type LessonSectionAdvance =
  | { kind: 'glyph'; position: LessonPosition }
  | { kind: 'section'; position: LessonPosition }
  | { kind: 'complete'; position: LessonPosition };

/** Build a 4-choice roman quiz for a glyph (pure; seeded RNG). */
export function buildRomanQuiz(
  glyph: AlphabetGlyph,
  pool: AlphabetGlyph[],
  rng: () => number,
): { prompt: string; answer: string; choices: string[] } {
  const distractors = new Set<string>();
  const others = pool.filter((g) => g.id !== glyph.id && g.roman !== glyph.roman);
  while (distractors.size < 3 && others.length > 0) {
    const pick = others[Math.floor(rng() * others.length)];
    if (pick) distractors.add(pick.roman);
    if (distractors.size >= others.length) break;
  }
  // Pad with distinct placeholders only if the pool is tiny (tests).
  const pad = ['xx', 'yy', 'zz'];
  let p = 0;
  while (distractors.size < 3) {
    distractors.add(pad[p++] ?? `x${distractors.size}`);
  }
  const choices = [glyph.roman, ...distractors].slice(0, 4);
  // Fisher–Yates with provided rng
  for (let i = choices.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  return {
    prompt: glyph.dewanagari,
    answer: glyph.roman,
    choices,
  };
}

export function gradeQuizChoice(choice: string, answer: string): boolean {
  return choice === answer;
}

/** Schema gate used by unit tests. */
export function validateAlphabetSchema(sections = ALPHABET_SECTIONS): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  if (sections.length < 3) errors.push('expected vowels, consonants, conjuncts');
  for (const section of sections) {
    if (!section.glyphs.length) errors.push(`${section.id}: empty`);
    for (const g of section.glyphs) {
      if (!g.dewanagari.trim()) errors.push(`${g.id}: missing dewanagari`);
      if (!g.roman.trim()) errors.push(`${g.id}: missing roman`);
      if (ids.has(g.id)) errors.push(`duplicate id ${g.id}`);
      ids.add(g.id);
    }
  }
  return errors;
}
