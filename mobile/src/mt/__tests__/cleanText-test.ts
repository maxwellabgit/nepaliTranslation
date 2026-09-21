import { cleanTranslationText } from '../cleanText';
import { translateOnDevice } from '../onDeviceTranslate';

describe('cleanTranslationText', () => {
  it('drops a trailing marker without removing the question mark', () => {
    expect(cleanTranslationText('Who are you?>')).toBe('Who are you?');
  });

  it('keeps letters, apostrophes, Devanagari, and danda', () => {
    expect(cleanTranslationText("  what's   up  ")).toBe("what's up");
    expect(cleanTranslationText('नमस्ते ।')).toBe('नमस्ते ।');
  });

  it('lets a marked sentence translate like the clean one', () => {
    const dirty = translateOnDevice('Who are you?>', 'en-ne', 'formal');
    const clean = translateOnDevice('Who are you?', 'en-ne', 'formal');
    expect(dirty.text).toBe(clean.text);
    expect(dirty.text).toBe('को हुन् तपाईं?');
  });
});
