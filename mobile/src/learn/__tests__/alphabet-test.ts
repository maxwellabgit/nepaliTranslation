import {
  ALPHABET_SECTIONS,
  advanceLesson,
  buildRomanQuiz,
  gradeQuizChoice,
  validateAlphabetSchema,
} from '../alphabet';

describe('alphabet schema', () => {
  it('has vowels, consonants, and conjuncts with unique ids and romans', () => {
    expect(validateAlphabetSchema()).toEqual([]);
    expect(ALPHABET_SECTIONS.map((s) => s.id)).toEqual([
      'vowels',
      'consonants',
      'conjuncts',
    ]);
    expect(ALPHABET_SECTIONS[0].glyphs.length).toBeGreaterThanOrEqual(10);
    expect(ALPHABET_SECTIONS[1].glyphs.length).toBeGreaterThanOrEqual(30);
  });

  it('distinguishes dental vs retroflex with IAST underdot notation', () => {
    const cons = ALPHABET_SECTIONS[1].glyphs;
    const retro = cons.find((g) => g.dewanagari === 'ट');
    const dental = cons.find((g) => g.dewanagari === 'त');
    expect(retro?.roman).toBe('ṭa');
    expect(retro?.place).toBe('retroflex');
    expect(dental?.roman).toBe('ta');
    expect(dental?.place).toBe('dental');
    expect(retro?.roman).not.toBe(dental?.roman);
  });

  it('advances within a section then to the next section', () => {
    const mid = advanceLesson({ sectionId: 'vowels', glyphIndex: 0 });
    expect(mid).toEqual({
      kind: 'glyph',
      position: { sectionId: 'vowels', glyphIndex: 1 },
    });
    const lastVowel = ALPHABET_SECTIONS[0].glyphs.length - 1;
    const toCons = advanceLesson({
      sectionId: 'vowels',
      glyphIndex: lastVowel,
    });
    expect(toCons).toEqual({
      kind: 'section',
      position: { sectionId: 'consonants', glyphIndex: 0 },
    });
  });

  it('builds a quiz with unique choices and exactly one correct answer', () => {
    const section = ALPHABET_SECTIONS[1];
    const glyph = section.glyphs.find((g) => g.dewanagari === 'ट')!;
    let seed = 1;
    const rng = () => {
      seed = (seed * 7 + 3) % 1000;
      return seed / 1000;
    };
    const quiz = buildRomanQuiz(glyph, section.glyphs, rng);
    expect(quiz.prompt).toBe('ट');
    expect(quiz.answer).toBe('ṭa');
    expect(quiz.choices).toHaveLength(4);
    expect(new Set(quiz.choices).size).toBe(4);
    expect(quiz.choices.filter((c) => c === quiz.answer)).toHaveLength(1);
    expect(gradeQuizChoice(quiz.answer, quiz.answer)).toBe(true);
    expect(gradeQuizChoice('ta', quiz.answer)).toBe(false);
  });
});
