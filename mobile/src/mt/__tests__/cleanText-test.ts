import { cleanTranslationText } from '../cleanText';

describe('cleanTranslationText', () => {
  it('drops a trailing marker without removing the question mark', () => {
    expect(cleanTranslationText('Who are you?>')).toBe('Who are you?');
  });

  it('keeps letters, apostrophes, Devanagari, and danda', () => {
    expect(cleanTranslationText("  what's   up  ")).toBe("what's up");
    expect(cleanTranslationText('नमस्ते ।')).toBe('नमस्ते ।');
  });

  it('cleans a marked sentence to the same text as the unmarked one', () => {
    expect(cleanTranslationText('Who are you?>')).toBe(
      cleanTranslationText('Who are you?'),
    );
  });
});
