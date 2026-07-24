import {
  translateOnDevice,
  translateBySentences,
  detectDirection,
} from '../onDeviceTranslate';

describe('detectDirection', () => {
  it('detects Devanagari and roman Nepali as ne-en', () => {
    expect(detectDirection('नमस्ते', 'en-ne')).toBe('ne-en');
    expect(detectDirection('namaste', 'en-ne')).toBe('ne-en');
  });

  it('detects Latin as en-ne', () => {
    expect(detectDirection('Hello', 'ne-en')).toBe('en-ne');
  });

  it('falls back to preferred', () => {
    expect(detectDirection('!!!', 'en-ne')).toBe('en-ne');
  });
});

describe('translateOnDevice', () => {
  it('returns empty phrase for blank', () => {
    expect(translateOnDevice('', 'en-ne')).toEqual({
      text: '',
      method: 'phrase',
      direction: 'en-ne',
    });
  });

  it('hits common EN→NE phrases', () => {
    const r = translateOnDevice('Hello', 'en-ne', 'formal');
    expect(r.method).toBe('phrase');
    expect(r.direction).toBe('en-ne');
    expect(r.text).toContain('नमस्ते');
  });

  it('normalizes trailing punctuation on phrases', () => {
    const r = translateOnDevice('How are you?', 'en-ne', 'formal');
    expect(r.method).toBe('phrase');
    expect(r.text.length).toBeGreaterThan(0);
  });

  it('hits NE→EN Devanagari phrases', () => {
    const r = translateOnDevice('नमस्ते', 'ne-en');
    expect(r.method).toBe('phrase');
    expect(r.direction).toBe('ne-en');
    expect(r.text.toLowerCase()).toContain('hello');
  });

  it('hits roman Nepali phrases', () => {
    const r = translateOnDevice('namaste', 'ne-en');
    expect(r.method).toBe('phrase');
    expect(r.text.toLowerCase()).toContain('hello');
  });

  it('applies informal rewrite on EN→NE', () => {
    const formal = translateOnDevice('How are you?', 'en-ne', 'formal');
    const informal = translateOnDevice('How are you?', 'en-ne', {
      formality: 'informal',
    });
    expect(formal.text).toMatch(/तपाईं/);
    expect(informal.text).toMatch(/तिमी/);
  });

  it('romanizes Nepali output when script=roman', () => {
    const r = translateOnDevice('Hello', 'en-ne', { script: 'roman' });
    expect(r.text).toMatch(/[a-z]/i);
    expect(r.text).not.toMatch(/[\u0900-\u097F]/);
  });

  it('uses lexicon for unknown free text', () => {
    const r = translateOnDevice('xyzzy unknownword', 'en-ne', 'formal');
    expect(r.method).toBe('lexicon');
  });

  it('respects forcePreferred', () => {
    const r = translateOnDevice('namaste', 'en-ne', { forcePreferred: true });
    expect(r.direction).toBe('en-ne');
  });
});

describe('translateBySentences', () => {
  it('delegates single sentence', () => {
    const r = translateBySentences('Hello', 'en-ne', { formality: 'formal' });
    expect(r.method).toBe('phrase');
    expect(r.text).toContain('नमस्ते');
  });

  it('joins multi-sentence translations', () => {
    const r = translateBySentences('Hello. Thank you.', 'en-ne', {
      formality: 'formal',
    });
    expect(r.text.length).toBeGreaterThan(0);
    expect(r.direction).toBe('en-ne');
  });
});
