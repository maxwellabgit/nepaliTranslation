import { TranslationEngine } from '../TranslationEngine';

describe('TranslationEngine', () => {
  it('warms to ready', async () => {
    const eng = new TranslationEngine();
    await eng.warmUp();
    expect(eng.getState()).toBe('ready');
  });

  it('translates via sentence path by default', async () => {
    const eng = new TranslationEngine();
    const r = await eng.translate({
      text: 'Hello',
      preferred: 'en-ne',
      formality: 'formal',
      script: 'deva',
    });
    expect(r.requestId).toBe(1);
    expect(r.method).toBe('phrase');
    expect(r.text).toContain('नमस्ते');
    expect(eng.getState()).toBe('ready');
  });

  it('supports bySentences false', async () => {
    const eng = new TranslationEngine();
    const r = await eng.translate({
      text: 'Hello',
      preferred: 'en-ne',
      formality: 'formal',
      script: 'deva',
      bySentences: false,
    });
    expect(r.method).toBe('phrase');
  });

  it('cancelAll bumps sequence', async () => {
    const eng = new TranslationEngine();
    await eng.translate({
      text: 'Hello',
      preferred: 'en-ne',
      formality: 'formal',
      script: 'deva',
    });
    eng.cancelAll();
    const r = await eng.translate({
      text: 'Thank you',
      preferred: 'en-ne',
      formality: 'formal',
      script: 'deva',
    });
    expect(r.requestId).toBeGreaterThan(1);
  });
});
