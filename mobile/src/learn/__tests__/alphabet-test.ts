import {
  ALPHABET_SECTIONS,
  advanceLesson,
  buildRomanQuiz,
  gradeQuizChoice,
  validateAlphabetSchema,
} from '../alphabet';

describe('alphabet schema', () => {
  it('has vowels, consonants, and conjuncts with unique ids', () => {
    expect(validateAlphabetSchema()).toEqual([]);
    expect(ALPHABET_SECTIONS.map((s) => s.id)).toEqual([
      'vowels',
      'consonants',
      'conjuncts',
    ]);
    expect(ALPHABET_SECTIONS[0].glyphs.length).toBeGreaterThanOrEqual(10);
    expect(ALPHABET_SECTIONS[1].glyphs.length).toBeGreaterThanOrEqual(30);
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

  it('builds a quiz with the correct answer among four choices', () => {
    const glyph = ALPHABET_SECTIONS[0].glyphs[0];
    let seed = 1;
    const rng = () => {
      seed = (seed * 7 + 3) % 1000;
      return seed / 1000;
    };
    const quiz = buildRomanQuiz(glyph, ALPHABET_SECTIONS[0].glyphs, rng);
    expect(quiz.prompt).toBe(glyph.dewanagari);
    expect(quiz.choices).toHaveLength(4);
    expect(quiz.choices).toContain(quiz.answer);
    expect(gradeQuizChoice(quiz.answer, quiz.answer)).toBe(true);
    expect(gradeQuizChoice('nope', quiz.answer)).toBe(false);
  });
});
