/**
 * Lightweight Devanagari ↔ display romanization for Nepali UI.
 * Not a full linguistic transliterator — good enough for v1 captions.
 */

const CONSONANTS: Record<string, string> = {
  क: 'k',
  ख: 'kh',
  ग: 'g',
  घ: 'gh',
  ङ: 'ng',
  च: 'ch',
  छ: 'chh',
  ज: 'j',
  झ: 'jh',
  ञ: 'ny',
  ट: 't',
  ठ: 'th',
  ड: 'd',
  ढ: 'dh',
  ण: 'n',
  त: 't',
  थ: 'th',
  द: 'd',
  ध: 'dh',
  न: 'n',
  प: 'p',
  फ: 'ph',
  ब: 'b',
  भ: 'bh',
  म: 'm',
  य: 'y',
  र: 'r',
  ल: 'l',
  व: 'w',
  श: 'sh',
  ष: 'sh',
  स: 's',
  ह: 'h',
  क्ष: 'ksh',
  त्र: 'tr',
  ज्ञ: 'gy',
};

const INDEPENDENT: Record<string, string> = {
  अ: 'a',
  आ: 'aa',
  इ: 'i',
  ई: 'ii',
  उ: 'u',
  ऊ: 'uu',
  ए: 'e',
  ऐ: 'ai',
  ओ: 'o',
  औ: 'au',
  अं: 'am',
  अः: 'ah',
  ऋ: 'ri',
};

const MATRAS: Record<string, string> = {
  'ा': 'aa',
  'ि': 'i',
  'ी': 'ii',
  'ु': 'u',
  'ू': 'uu',
  'े': 'e',
  'ै': 'ai',
  'ो': 'o',
  'ौ': 'au',
  'ृ': 'ri',
  'ं': 'n',
  'ः': 'h',
  'ँ': 'n',
};

const VIRAMA = '्';

/** Common phrase overrides (natural chat romanization). */
const PHRASE_ROMAN: Record<string, string> = {
  नमस्ते: 'namaste',
  धन्यवाद: 'dhanyabad',
  कृपया: 'kripya',
  हो: 'ho',
  होइन: 'hoina',
  'ठिक छ': 'thik cha',
  'माफ गर्नुहोस्': 'maaf garnuhos',
  मद्दत: 'madat',
  'तपाईंलाई कस्तो छ': 'tapai lai kasto cha',
  'तिमीलाई कस्तो छ': 'timi lai kasto cha',
  'म ठिक छु': 'ma thik chu',
  'शुभ प्रभात': 'shubha prabhat',
  'शुभ रात्री': 'shubha ratri',
  स्वागत: 'swagat',
  'स्वागत छ': 'swagat cha',
  बिदा: 'bida',
};

export function looksLikeRomanNepali(text: string): boolean {
  const t = text.toLowerCase();
  if (!/[a-z]/.test(t)) return false;
  if (/[\u0900-\u097F]/.test(t)) return false;
  return /\b(namaste|dhanyabad|dhanyabad|tapai|timi|kasto|chha|cha\b|hoina|malai|mero|kaha|garnuhos|dinuhos|bhetaula|bhokeko|swagat|shubha|maaf|kripya|thik|chu|chhu|lai|ko\b|le\b|ho\b)\b/i.test(
    t,
  );
}

export function devanagariToRoman(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  if (PHRASE_ROMAN[trimmed]) return PHRASE_ROMAN[trimmed];
  // Try without trailing punctuation
  const bare = trimmed.replace(/[?.!,;:।]+$/u, '');
  const punct = trimmed.slice(bare.length);
  if (PHRASE_ROMAN[bare]) return PHRASE_ROMAN[bare] + punct;

  let out = '';
  let i = 0;
  const s = text;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch) || /[?.!,;:।0-9A-Za-z]/.test(ch)) {
      out += ch;
      i += 1;
      continue;
    }
    if (INDEPENDENT[ch]) {
      out += INDEPENDENT[ch];
      i += 1;
      continue;
    }
    // conjuncts
    if (i + 1 < s.length && CONSONANTS[s.slice(i, i + 2)]) {
      // skip — single chars only in map for now
    }
    const cons = CONSONANTS[ch];
    if (cons) {
      let vowel = 'a';
      let j = i + 1;
      if (j < s.length && s[j] === VIRAMA) {
        vowel = '';
        j += 1;
      } else if (j < s.length && MATRAS[s[j]]) {
        vowel = MATRAS[s[j]];
        j += 1;
      }
      // anusvara / chandrabindu after matra
      if (j < s.length && (s[j] === 'ं' || s[j] === 'ँ')) {
        vowel += 'n';
        j += 1;
      }
      out += cons + vowel;
      i = j;
      continue;
    }
    if (MATRAS[ch]) {
      out += MATRAS[ch];
      i += 1;
      continue;
    }
    if (ch === VIRAMA) {
      i += 1;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out.replace(/\s+/g, ' ').trim();
}

/** Format Nepali text for the selected script preference. */
export function formatNepaliScript(
  text: string,
  script: 'deva' | 'roman',
): string {
  if (!text) return '';
  if (script === 'deva') return text;
  if (/[\u0900-\u097F]/.test(text)) return devanagariToRoman(text);
  return text;
}
