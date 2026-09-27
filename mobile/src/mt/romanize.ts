/**
 * Devanagari ↔ Latin script.
 * This is a letter transliterator so the script toggle and the indic-en
 * checkpoint can see one script. It does not translate.
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
  return syllablesToDeva(tok.toLowerCase());
}

export function looksLikeRomanNepali(text: string): boolean {
  const t = text.toLowerCase();
  if (!/[a-z]/.test(t)) return false;
  if (/[\u0900-\u097F]/.test(t)) return false;
  return /\b(namaste|dhanyabad|tapai|timi|kasto|chha|hoina|malai|mero|kaha|garnuhos|dinuhos|swagat|maaf|kripya|thik|bujhina|shauchalaya|madat)\b/i.test(
    t,
  );
}

/**
 * Syllable parser for chat-style Roman Nepali → Devanagari,
 * so the indic-en checkpoint receives Devanagari.
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
  const hasDeva = /[\u0900-\u097F]/.test(text);
  if (script === 'roman') return hasDeva ? devanagariToRoman(text) : text;
  if (hasDeva) return text;
  if (looksLikeRomanNepali(text)) return romanToDevanagari(text);
  return text;
}

/** Nepali in the script the gold toggle did not select. Empty when there is nothing else to show. */
export function companionNepaliScript(
  text: string,
  script: 'deva' | 'roman',
): string {
  const selected = formatNepaliScript(text, script);
  const other = formatNepaliScript(text, script === 'deva' ? 'roman' : 'deva');
  if (!other.trim() || other === selected) return '';
  return other;
}
