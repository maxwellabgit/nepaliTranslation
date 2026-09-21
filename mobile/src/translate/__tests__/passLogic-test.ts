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
  test('english and nepali copy', () => {
    expect(emptyShowFallback('en')).toMatch(/phrase/i);
    expect(emptyShowFallback('ne')).toMatch(/phrase/i);
  });
});
