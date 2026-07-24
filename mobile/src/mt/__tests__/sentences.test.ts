import {
  splitSentences,
  takeNewCompleteSentences,
  isMultiSentence,
  suggestAlignedSplits,
  IT2_WINDOW,
} from '../sentences';

describe('splitSentences', () => {
  it('handles empty', () => {
    expect(splitSentences('')).toEqual({ complete: [], remainder: '' });
  });

  it('keeps incomplete remainder', () => {
    expect(splitSentences('Hello there')).toEqual({
      complete: [],
      remainder: 'Hello there',
    });
  });

  it('splits Latin terminals', () => {
    const r = splitSentences('Hi. Bye!');
    expect(r.complete).toEqual(['Hi.', 'Bye!']);
    expect(r.remainder).toBe('');
  });

  it('splits Devanagari danda', () => {
    const r = splitSentences('नमस्ते। धन्यवाद।');
    expect(r.complete.length).toBe(2);
    expect(r.remainder).toBe('');
  });
});

describe('takeNewCompleteSentences', () => {
  it('emits only new completes', () => {
    const first = takeNewCompleteSentences('Hi. More', 0);
    expect(first.newSentences).toEqual(['Hi.']);
    expect(first.nextEmittedCount).toBe(1);
    expect(first.remainder).toBe('More');

    const second = takeNewCompleteSentences('Hi. More text.', 1);
    expect(second.newSentences).toEqual(['More text.']);
    expect(second.nextEmittedCount).toBe(2);
  });

  it('does not re-emit when count caught up', () => {
    const r = takeNewCompleteSentences('Hi.', 1);
    expect(r.newSentences).toEqual([]);
  });
});

describe('isMultiSentence', () => {
  it('flags multiple completes', () => {
    expect(isMultiSentence('A. B.')).toBe(true);
    expect(isMultiSentence('Hello')).toBe(false);
  });
});

describe('suggestAlignedSplits', () => {
  it('pairs equal counts', () => {
    const pairs = suggestAlignedSplits('Hi. Bye.', 'नमस्ते। बिदा।');
    expect(pairs).toHaveLength(2);
    expect(pairs![0].source).toContain('Hi');
  });

  it('returns null on mismatch', () => {
    expect(suggestAlignedSplits('Hi. Bye.', 'नमस्ते।')).toBeNull();
    expect(suggestAlignedSplits('Hi', 'नमस्ते')).toBeNull();
  });
});

describe('IT2_WINDOW', () => {
  it('exports fine-tune and model limits', () => {
    expect(IT2_WINDOW.softCharMax).toBe(140);
    expect(IT2_WINDOW.hardCharMax).toBe(220);
    expect(IT2_WINDOW.fineTuneMaxLength).toBe(96);
  });
});
