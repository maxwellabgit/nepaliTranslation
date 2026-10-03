import { matchTerminalPunctuation as match } from '../terminalPunctuation';

describe('source terminal punctuation', () => {
  test.each([
    ['Hello', 'नमस्ते।', 'नमस्ते'],
    ['Who are you?', 'तपाईं को हुनुहुन्छ।', 'तपाईं को हुनुहुन्छ?'],
    ['Hello!', 'नमस्ते?', 'नमस्ते!'],
    ['Hello.', 'नमस्ते!', 'नमस्ते।'],
    ['Really?!', 'साँच्चै।', 'साँच्चै?!'],
    ['Wait...', 'पर्खनुहोस्।', 'पर्खनुहोस्...'],
    ['Hello?', '“नमस्ते”', '“नमस्ते?”'],
    ['Hello', '“नमस्ते।”', '“नमस्ते”'],
    ['It costs 3.14', 'यसको मूल्य 3.14।', 'यसको मूल्य 3.14'],
    ['One, then two', 'एक, त्यसपछि दुई।', 'एक, त्यसपछि दुई'],
  ])('%s determines ending', (source, output, expected) => {
    expect(match(source, output, 'en-ne')).toBe(expected);
  });
  test('uses dots in English and Roman Nepali, preserves abbreviation dots', () => {
    expect(match('नमस्ते।', 'Hello?', 'ne-en')).toBe('Hello.');
    expect(match('Hello.', 'namaste!', 'en-ne', 'roman')).toBe('namaste.');
    expect(match('A doctor', 'Dr.', 'ne-en')).toBe('Dr.');
    expect(match('A country', 'U.S.', 'ne-en')).toBe('U.S.');
    expect(match('Dr.', 'डाक्टर।', 'en-ne')).toBe('डाक्टर');
  });
});
