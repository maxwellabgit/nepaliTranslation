/**
 * Everyday Nepali Devanagari ↔ chat-Roman.
 *
 * Roman → Devanagari is lexicon-first (meaning-bank words) then a
 * syllable parser. The old greedy letter matcher treated every "a" as
 * independent अ and produced unreadable input for the NE→EN model.
 */
import { meaningLexicon, normKey } from './meaningLexicon';

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

/** Longest-first chat-Roman consonant spellings. */
const CONS_ROMAN: Array<[string, string]> = [
  ['chh', 'छ'],
  ['ksh', 'क्ष'],
  ['gy', 'ज्ञ'],
  ['tr', 'त्र'],
  ['kh', 'ख'],
  ['gh', 'घ'],
  ['ng', 'ङ'],
  ['ch', 'च'],
  ['jh', 'झ'],
  ['th', 'थ'],
  ['dh', 'ध'],
  ['ph', 'फ'],
  ['bh', 'भ'],
  ['sh', 'श'],
  ['ny', 'ञ'],
  ['k', 'क'],
  ['g', 'ग'],
  ['j', 'ज'],
  ['t', 'त'],
  ['d', 'द'],
  ['n', 'न'],
  ['p', 'प'],
  ['b', 'ब'],
  ['m', 'म'],
  ['y', 'य'],
  ['r', 'र'],
  ['l', 'ल'],
  ['w', 'व'],
  ['v', 'व'],
  ['s', 'स'],
  ['h', 'ह'],
];

const VOWEL_ROMAN = ['aa', 'ii', 'ee', 'uu', 'oo', 'ai', 'au', 'a', 'i', 'u', 'e', 'o'];

const INDEP_FROM_ROMAN: Record<string, string> = {
  aa: 'आ',
  ii: 'ई',
  ee: 'ई',
  uu: 'ऊ',
  oo: 'ऊ',
  ai: 'ऐ',
  au: 'औ',
  a: 'अ',
  i: 'इ',
  u: 'उ',
  e: 'ए',
  o: 'ओ',
};

const MATRA_FROM_ROMAN: Record<string, string> = {
  aa: 'ा',
  ii: 'ी',
  ee: 'ी',
  uu: 'ू',
  oo: 'ू',
  ai: 'ै',
  au: 'ौ',
  a: '',
  i: 'ि',
  u: 'ु',
  e: 'े',
  o: 'ो',
};

function matchAt(
  s: string,
  i: number,
  table: Array<[string, string]> | string[],
): { rom: string; extra?: string; n: number } | null {
  if (Array.isArray(table) && table.length && typeof table[0] === 'string') {
    for (const rom of table as string[]) {
      if (s.startsWith(rom, i)) return { rom, n: rom.length };
    }
    return null;
  }
  for (const [rom, extra] of table as Array<[string, string]>) {
    if (s.startsWith(rom, i)) return { rom, extra, n: rom.length };
  }
  return null;
}

/** Syllable parser for a single roman token with no spaces. */
function syllablesToDeva(raw: string): string {
  const s = raw.toLowerCase();
  let i = 0;
  let out = '';
  while (i < s.length) {
    const cons = matchAt(s, i, CONS_ROMAN);
    if (cons) {
      const after = i + cons.n;
      const vow = matchAt(s, after, VOWEL_ROMAN);
      if (vow) {
        out += (cons.extra ?? '') + (MATRA_FROM_ROMAN[vow.rom] ?? '');
        i = after + vow.n;
      } else {
        // No vowel written: conjunct if more letters follow, else keep inherent a.
        const more = after < s.length && /[a-z]/.test(s[after]);
        out += (cons.extra ?? '') + (more ? VIRAMA : '');
        i = after;
      }
      continue;
    }
    const vow = matchAt(s, i, VOWEL_ROMAN);
    if (vow) {
      out += INDEP_FROM_ROMAN[vow.rom] ?? '';
      i += vow.n;
      continue;
    }
    out += s[i];
    i += 1;
  }
  return out;
}

function tokenToDeva(tok: string): string {
  const key = tok.toLowerCase();
  const hit = meaningLexicon.romanWords[key];
  if (hit) return hit;
  return syllablesToDeva(key);
}

export function looksLikeRomanNepali(text: string): boolean {
  const t = text.toLowerCase();
  if (!/[a-z]/.test(t)) return false;
  if (/[\u0900-\u097F]/.test(t)) return false;
  const words = t.match(/[a-z]+/g) ?? [];
  if (!words.length) return false;
  let hits = 0;
  for (const w of words) {
    if (meaningLexicon.romanWords[w]) hits += 1;
  }
  if (hits >= 2) return true;
  if (words.length === 1 && hits === 1 && words[0].length >= 4) return true;
  return /\b(namaste|dhanyabad|tapai|timi|kasto|chha|hoina|malai|mero|kaha|garnuhos|dinuhos|swagat|maaf|kripya|thik|bujhina|shauchalaya|madat)\b/i.test(
    t,
  );
}

/**
 * Chat-style Roman Nepali → Devanagari.
 * Known words come from the meaning bank; the rest is syllable-parsed.
 */
export function romanToDevanagari(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  if (/[\u0900-\u097F]/.test(trimmed)) return trimmed;

  const tokens = trimmed.split(/(\s+|[?.!,;:।]+)/u);
  const out: string[] = [];
  for (const tok of tokens) {
    if (!tok) continue;
    if (/^\s+$/.test(tok)) {
      out.push(tok);
      continue;
    }
    if (/^[?.!,;:।]+$/u.test(tok)) {
      out.push(tok === '.' || tok === '!' || tok === '?' ? '।' : tok);
      continue;
    }
    out.push(tokenToDeva(tok));
  }
  return out.join('').replace(/\s+/g, ' ').trim();
}

export function devanagariToRoman(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  if (PHRASE_ROMAN[trimmed]) return PHRASE_ROMAN[trimmed];
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

export function formatNepaliScript(
  text: string,
  script: 'deva' | 'roman',
): string {
  if (!text) return '';
  if (script === 'deva') return text;
  if (/[\u0900-\u097F]/.test(text)) return devanagariToRoman(text);
  return text;
}

export { normKey };
