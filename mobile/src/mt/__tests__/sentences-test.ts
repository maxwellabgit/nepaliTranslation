import { splitSentences, takeNewCompleteSentences } from '../sentences';

test.each([
  ['“Hello!” Are you well?', ['“Hello!”', 'Are you well?']],
  ['Dr. Smith left. Are you well?', ['Dr. Smith left.', 'Are you well?']],
  ['It costs 3.14. Buy it!', ['It costs 3.14.', 'Buy it!']],
  ['The U.S. embassy called. “Why?”', ['The U.S. embassy called.', '“Why?”']],
  ['She said (hello!). Then left.', ['She said (hello!).', 'Then left.']],
  ['“नमस्ते।” सन्चै छ?', ['“नमस्ते।”', 'सन्चै छ?']],
])('splits %s at actual sentence boundaries', (input, complete) => {
  expect(splitSentences(input)).toEqual({ complete, remainder: '' });
});

test('keeps incomplete quoted speech as remainder and emits complete quoted STT once', () => {
  expect(splitSentences('Dr. Smith said “Hello')).toEqual({ complete: [], remainder: 'Dr. Smith said “Hello' });
  expect(takeNewCompleteSentences('“Hello!” Are you', 0)).toEqual({
    newSentences: ['“Hello!”'], nextEmittedCount: 1, remainder: 'Are you',
  });
});
