import { canPassPhone, emptyShowFallback } from '../passLogic';

describe('canPassPhone', () => {
  test.each([
    ['interim present', 'hello', null, 'en' as const, true],
    ['whitespace interim ignored', '   ', null, 'en' as const, false],
    ['latest from same side', '', 'en' as const, 'en' as const, true],
    ['latest from other side', '', 'ne' as const, 'en' as const, false],
    ['no interim no latest', '', null, 'ne' as const, false],
  ])('%s', (_label, interim, latestFrom, side, expected) => {
    expect(canPassPhone(interim, latestFrom, side)).toBe(expected);
  });
});

describe('emptyShowFallback', () => {
  test('returns English copy for en side', () => {
    expect(emptyShowFallback('en')).toBe('No saved phrase yet');
  });
  test('returns Nepali-oriented copy for ne side', () => {
    expect(emptyShowFallback('ne')).toBe('No phrase match');
  });
});
