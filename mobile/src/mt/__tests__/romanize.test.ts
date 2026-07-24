import {
  looksLikeRomanNepali,
  devanagariToRoman,
  formatNepaliScript,
} from '../romanize';

describe('looksLikeRomanNepali', () => {
  it('detects common roman Nepali', () => {
    expect(looksLikeRomanNepali('namaste')).toBe(true);
    expect(looksLikeRomanNepali('tapai lai kasto cha')).toBe(true);
    expect(looksLikeRomanNepali('hoina')).toBe(true);
  });

  it('rejects English, Devanagari, empty', () => {
    expect(looksLikeRomanNepali('hello')).toBe(false);
    expect(looksLikeRomanNepali('नमस्ते')).toBe(false);
    expect(looksLikeRomanNepali('')).toBe(false);
    expect(looksLikeRomanNepali('123')).toBe(false);
  });
});

describe('devanagariToRoman', () => {
  it('returns empty for blank', () => {
    expect(devanagariToRoman('')).toBe('');
    expect(devanagariToRoman('   ')).toBe('');
  });

  it('uses phrase overrides', () => {
    expect(devanagariToRoman('नमस्ते')).toBe('namaste');
    expect(devanagariToRoman('धन्यवाद')).toBe('dhanyabad');
    expect(devanagariToRoman('ठिक छ')).toBe('thik cha');
    expect(devanagariToRoman('नमस्ते!')).toBe('namaste!');
  });

  it('romanizes simple consonants with inherent a', () => {
    expect(devanagariToRoman('क')).toBe('ka');
    expect(devanagariToRoman('का')).toBe('kaa');
  });
});

describe('formatNepaliScript', () => {
  it('keeps Devanagari for deva', () => {
    expect(formatNepaliScript('नमस्ते', 'deva')).toBe('नमस्ते');
  });

  it('romanizes for roman', () => {
    expect(formatNepaliScript('नमस्ते', 'roman')).toBe('namaste');
  });
});
