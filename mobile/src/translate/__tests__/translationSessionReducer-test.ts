import {
  initialSession,
  oppositeSide,
  reduceSession,
  sessionPhase,
} from '../translationSessionReducer';

describe('translation session', () => {
  it('returns to English after one pass from each person', () => {
    let state = initialSession(null);
    expect(sessionPhase(state)).toBe('empty');
    expect(state.activeSide).toBe('en');

    state = reduceSession(state, {
      type: 'commitTurn',
      keepDraft: true,
      turn: {
        id: 'a',
        from: 'en',
        source: 'Hello',
        translation: 'नमस्ते',
      },
    });
    expect(sessionPhase(state)).toBe('single');
    state = reduceSession(state, { type: 'pass' });
    expect(state.activeSide).toBe('ne');

    state = reduceSession(state, { type: 'setDraft', text: 'नमस्ते' });
    state = reduceSession(state, {
      type: 'commitTurn',
      keepDraft: true,
      turn: {
        id: 'b',
        from: 'ne',
        source: 'नमस्ते',
        translation: 'Hello',
      },
    });
    expect(sessionPhase(state)).toBe('exchange');
    state = reduceSession(state, { type: 'pass' });
    expect(state.activeSide).toBe('en');
    expect(oppositeSide('en')).toBe('ne');
  });
});
