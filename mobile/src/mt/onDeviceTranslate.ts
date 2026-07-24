/**
 * On-device English ↔ Nepali translation.
 * No network. Phrase pack + word lexicon (bundled).
 */

import {
  formatNepaliScript,
  looksLikeRomanNepali,
} from './romanize';
import { splitSentences } from './sentences';

export type Direction = 'en-ne' | 'ne-en';
export type Formality = 'formal' | 'informal';
/** Devanagari (on) vs Roman Nepali (off) for Nepali display / preference. */
export type NepaliScript = 'deva' | 'roman';

const DEVANAGARI = /[\u0900-\u097F]/;

const INFORMAL_REWRITES: [string, string][] = [
  ['तपाईंहरू', 'तिमीहरू'],
  ['तपाईँहरू', 'तिमीहरू'],
  ['तपाईंलाई', 'तिमीलाई'],
  ['तपाईँलाई', 'तिमीलाई'],
  ['तपाईंको', 'तिमीको'],
  ['तपाईँको', 'तिमीको'],
  ['तपाईंले', 'तिमीले'],
  ['तपाईँले', 'तिमीले'],
  ['तपाईं', 'तिमी'],
  ['तपाईँ', 'तिमी'],
];

function applyInformal(ne: string): string {
  let out = ne;
  for (const [a, b] of INFORMAL_REWRITES) out = out.split(a).join(b);
  return out;
}

/** Exact / near-exact phrase pairs (traveler + daily). Longer phrases first in compose. */
const PHRASES: [string, string][] = [
  ['hello', 'नमस्ते'],
  ['hi', 'नमस्ते'],
  ['hey', 'हे'],
  ['goodbye', 'बिदा'],
  ['bye', 'बिदा'],
  ['thank you', 'धन्यवाद'],
  ['thanks', 'धन्यवाद'],
  ['please', 'कृपया'],
  ['yes', 'हो'],
  ['no', 'होइन'],
  ['ok', 'ठिक छ'],
  ['okay', 'ठिक छ'],
  ['sorry', 'माफ गर्नुहोस्'],
  ['excuse me', 'माफ गर्नुहोस्'],
  ['help', 'मद्दत'],
  ['help me', 'मलाई मद्दत गर्नुहोस्'],
  ['i need help', 'मलाई मद्दत चाहियो'],
  ['how are you', 'तपाईंलाई कस्तो छ'],
  ["how are you?", 'तपाईंलाई कस्तो छ?'],
  ["what's up", 'के छ'],
  ['whats up', 'के छ'],
  ['what is up', 'के छ'],
  ["hey what's up", 'हे, के छ'],
  ['hey whats up', 'हे, के छ'],
  ['hey there', 'हे'],
  ["how's it going", 'कस्तो छ'],
  ['how is it going', 'कस्तो छ'],
  ['can you hear me', 'के तपाईंले मलाई सुन्न सक्नुहुन्छ'],
  ['can you hear me?', 'के तपाईंले मलाई सुन्न सक्नुहुन्छ?'],
  ["hey what's up can you hear me", 'हे, के छ? के तपाईंले मलाई सुन्न सक्नुहुन्छ'],
  ['hey whats up can you hear me', 'हे, के छ? के तपाईंले मलाई सुन्न सक्नुहुन्छ'],
  ['can you help me', 'के तपाईं मलाई मद्दत गर्न सक्नुहुन्छ'],
  ['can you help me?', 'के तपाईं मलाई मद्दत गर्न सक्नुहुन्छ?'],
  ['can you speak english', 'के तपाईं अंग्रेजी बोल्नुहुन्छ'],
  ['can you speak nepali', 'के तपाईं नेपाली बोल्नुहुन्छ'],
  ['i would like water', 'म पानी चाहन्छु'],
  ["i'd like water", 'म पानी चाहन्छु'],
  ['i would like tea', 'म चिया चाहन्छु'],
  ["i'd like tea", 'म चिया चाहन्छु'],
  ['how do you say', 'तपाईं कसरी भन्नुहुन्छ'],
  ['what does this mean', 'यसको अर्थ के हो'],
  ["what does this mean?", 'यसको अर्थ के हो?'],
  ['i am learning nepali', 'म नेपाली सिक्दै छु'],
  ["i'm learning nepali", 'म नेपाली सिक्दै छु'],
  ['please speak slowly', 'कृपया बिस्तारै बोल्नुहोस्'],
  ['one moment', 'एकछिन'],
  ['just a moment', 'एकछिन'],
  ['no problem', 'कुनै समस्या छैन'],
  ['of course', 'हुन्छ'],
  ['see you tomorrow', 'भोलि भेटौंला'],
  ['have a nice day', 'तपाईंको दिन शुभ रहोस्'],
  ['did you hear me', 'के तपाईंले मलाई सुन्नुभयो'],
  ['are you there', 'के तपाईं हुनुहुन्छ'],
  ['are you there?', 'के तपाईं हुनुहुन्छ?'],
  ['are you listening', 'के तपाईं सुन्दै हुनुहुन्छ'],
  ['i can hear you', 'म तपाईंलाई सुन्न सक्छु'],
  ['i cannot hear you', 'म तपाईंलाई सुन्न सक्दिन'],
  ["i can't hear you", 'म तपाईंलाई सुन्न सक्दिन'],
  ['what are you doing', 'तपाईं के गर्दै हुनुहुन्छ'],
  ['what are you doing?', 'तपाईं के गर्दै हुनुहुन्छ?'],
  ['what are you doing today', 'तपाईं आज के गर्दै हुनुहुन्छ'],
  ['what are you doing today?', 'तपाईं आज के गर्दै हुनुहुन्छ?'],
  ['what are you doing right now', 'तपाईं अहिले के गर्दै हुनुहुन्छ'],
  ['i am fine', 'म ठिक छु'],
  ["i'm fine", 'म ठिक छु'],
  ["i'm good", 'म ठिक छु'],
  ['where are you', 'तपाईं कहाँ हुनुहुन्छ'],
  ['where are you?', 'तपाईं कहाँ हुनुहुन्छ?'],
  ['where are you from', 'तपाईं कहाँबाट हुनुहुन्छ'],
  ['where are you from?', 'तपाईं कहाँबाट हुनुहुन्छ?'],
  ['nice to see you', 'तपाईंलाई भेटेर खुशी लाग्यो'],
  ['see you later', 'पछि भेटौंला'],
  ['see you', 'भेटौंला'],
  ['welcome', 'स्वागत छ'],
  ['good to meet you', 'तपाईंलाई भेटेर खुशी लाग्यो'],
  ['good morning', 'शुभ प्रभात'],
  ['good afternoon', 'शुभ दिउँसो'],
  ['good evening', 'शुभ सन्ध्या'],
  ['good night', 'शुभ रात्री'],
  ['what is your name', 'तपाईंको नाम के हो'],
  ["what's your name", 'तपाईंको नाम के हो'],
  ["what's your name?", 'तपाईंको नाम के हो?'],
  ['my name is', 'मेरो नाम'],
  ['nice to meet you', 'तपाईंलाई भेटेर खुशी लाग्यो'],
  ['where is the bathroom', 'शौचालय कहाँ छ'],
  ['where is the toilet', 'शौचालय कहाँ छ'],
  ['how much is this', 'यो कति हो'],
  ['how much does this cost', 'यसको मूल्य कति हो'],
  ['too expensive', 'धेरै महँगो'],
  ['cheap', 'सस्तो'],
  ['water', 'पानी'],
  ['food', 'खाना'],
  ['i am hungry', 'म भोकाएको छु'],
  ["i'm hungry", 'म भोकाएको छु'],
  ['i am thirsty', 'म तिर्खाएको छु'],
  ['where is the hotel', 'होटल कहाँ छ'],
  ['where is the airport', 'विमानस्थल कहाँ छ'],
  ['taxi', 'ट्याक्सी'],
  ['bus', 'बस'],
  ['train', 'रेल'],
  ['i do not understand', 'मैले बुझिनँ'],
  ["i don't understand", 'मैले बुझिनँ'],
  ['do you speak english', 'के तपाईं अंग्रेजी बोल्नुहुन्छ'],
  ['do you speak english?', 'के तपाईं अंग्रेजी बोल्नुहुन्छ?'],
  ['speak slowly', 'बिस्तारै बोल्नुहोस्'],
  ['repeat please', 'फेरि भन्नुहोस्'],
  ['one', 'एक'],
  ['two', 'दुई'],
  ['three', 'तीन'],
  ['four', 'चार'],
  ['five', 'पाँच'],
  ['six', 'छ'],
  ['seven', 'सात'],
  ['eight', 'आठ'],
  ['nine', 'नौ'],
  ['ten', 'दस'],
  ['left', 'बायाँ'],
  ['right', 'दायाँ'],
  ['straight', 'सिधा'],
  ['stop', 'रोक्नुहोस्'],
  ['go', 'जानुहोस्'],
  ['come', 'आउनुहोस्'],
  ['today', 'आज'],
  ['tomorrow', 'भोलि'],
  ['yesterday', 'हिजो'],
  ['now', 'अहिले'],
  ['later', 'पछि'],
  ['open', 'खुला'],
  ['closed', 'बन्द'],
  ['doctor', 'डाक्टर'],
  ['hospital', 'अस्पताल'],
  ['police', 'प्रहरी'],
  ['embassy', 'दूतावास'],
  ['i am lost', 'म हराएँ'],
  ["i'm lost", 'म हराएँ'],
  ['call the police', 'प्रहरीलाई बोलाउनुहोस्'],
  ['i love nepal', 'म नेपाललाई माया गर्छु'],
  ['beautiful', 'सुन्दर'],
  ['delicious', 'मिठो'],
  ['hot', 'तातो'],
  ['cold', 'चिसो'],
  ['rain', 'पानी पर्ने'],
  ['sun', 'घाम'],
  ['mountain', 'पहाड'],
  ['temple', 'मन्दिर'],
  ['how much', 'कति'],
  ['where', 'कहाँ'],
  ['when', 'कहिले'],
  ['why', 'किन'],
  ['who', 'को'],
  ['what', 'के'],
  ['which', 'कुन'],
  ['friend', 'साथी'],
  ['family', 'परिवार'],
  ['mother', 'आमा'],
  ['father', 'बुबा'],
  ['brother', 'भाइ'],
  ['sister', 'दिदी'],
  ['child', 'बच्चा'],
  ['man', 'मानिस'],
  ['woman', 'महिला'],
  ['tea', 'चिया'],
  ['coffee', 'कफी'],
  ['rice', 'भात'],
  ['dal', 'दाल'],
  ['bread', 'रोटी'],
  ['meat', 'मासु'],
  ['vegetarian', 'शाकाहारी'],
  ['bill please', 'बिल दिनुहोस्'],
  ['check please', 'बिल दिनुहोस्'],
  ['receipt', 'रसिद'],
  ['wifi password', 'वाइफाइ पासवर्ड'],
  ['what time is it', 'कति बज्यो'],
  ["what's the time", 'कति बज्यो'],
  ['i want this', 'म यो चाहन्छु'],
  ['i want that', 'म त्यो चाहन्छु'],
  ['this one', 'यो'],
  ['that one', 'त्यो'],
  ['how do i get to', 'म कसरी पुग्ने'],
  ['is it far', 'के टाढा छ'],
  ['is it near', 'के नजिक छ'],
  ['near', 'नजिक'],
  ['far', 'टाढा'],
  ['entrance', 'प्रवेशद्वार'],
  ['exit', 'निकास'],
  ['ticket', 'टिकट'],
  ['passport', 'पासपोर्ट'],
  ['money', 'पैसा'],
  ['cash', 'नगद'],
  ['card', 'कार्ड'],
  ['phone', 'फोन'],
  ['charger', 'चार्जर'],
  ['bathroom', 'शौचालय'],
  ['toilet', 'शौचालय'],
  ['room', 'कोठा'],
  ['key', 'चाबी'],
  ['reservation', 'आरक्षण'],
  ['i have a reservation', 'मेरो आरक्षण छ'],
  ['little', 'थोरै'],
  ['bit', 'अलिकति'],
  ['a little', 'अलिकति'],
  ['a little bit', 'अलिकति'],
  ['dog', 'कुकुर'],
  ['growled', 'गुर्रायो'],
  ['growl', 'गुर्राउनु'],
  ['barked', 'भुक्यो'],
  ['bark', 'भुक्नु'],
  ['cooper', 'कुपर'],
  ['listening', 'सुन्दै'],
  ['listening...', 'सुन्दै...'],
];

/** Single-word lexicon for leftovers (EN → NE). */
const EN_WORDS: Record<string, string> = {
  i: 'म',
  me: 'मलाई',
  my: 'मेरो',
  you: 'तपाईं',
  your: 'तपाईंको',
  he: 'उनी',
  she: 'उनी',
  we: 'हामी',
  they: 'उनीहरू',
  is: 'हो',
  are: 'हुन्',
  am: 'छु',
  was: 'थियो',
  were: 'थिए',
  have: 'छ',
  has: 'छ',
  do: 'गर्नु',
  does: 'गर्छ',
  did: 'गर्यो',
  doing: 'गर्दै',
  not: 'होइन',
  and: 'र',
  or: 'वा',
  but: 'तर',
  with: 'सँग',
  without: 'बिना',
  for: 'लागि',
  to: 'लाई',
  from: 'बाट',
  in: 'मा',
  on: 'मा',
  at: 'मा',
  of: 'को',
  the: '',
  a: '',
  an: '',
  this: 'यो',
  that: 'त्यो',
  here: 'यहाँ',
  there: 'त्यहाँ',
  very: 'धेरै',
  much: 'धेरै',
  many: 'धेरै',
  some: 'केही',
  all: 'सबै',
  want: 'चाहन्छु',
  need: 'चाहियो',
  like: 'मन पर्छ',
  love: 'माया',
  know: 'थाहा',
  see: 'देख्नु',
  go: 'जानु',
  come: 'आउनु',
  eat: 'खानु',
  drink: 'पिउनु',
  buy: 'किन्नु',
  sell: 'बेच्नु',
  give: 'दिनु',
  take: 'लिनु',
  make: 'बनाउनु',
  say: 'भन्नु',
  tell: 'भन्नु',
  ask: 'सोध्नु',
  look: 'हेर्नु',
  find: 'पाउनु',
  wait: 'पर्खनु',
  sit: 'बस्नु',
  stand: 'उभिनु',
  walk: 'हिँड्नु',
  run: 'दौडनु',
  sleep: 'सुत्नु',
  hear: 'सुन्नु',
  listen: 'सुन्नु',
  listening: 'सुन्दै',
  speak: 'बोल्नु',
  understand: 'बुझ्नु',
  help: 'मद्दत',
  please: 'कृपया',
  yes: 'हो',
  no: 'होइन',
  ok: 'ठिक',
  okay: 'ठिक',
  hey: 'हे',
  hi: 'नमस्ते',
  hello: 'नमस्ते',
  up: 'माथि',
  down: 'तल',
  work: 'काम',
  home: 'घर',
  house: 'घर',
  city: 'शहर',
  village: 'गाउँ',
  country: 'देश',
  nepal: 'नेपाल',
  kathmandu: 'काठमाडौं',
  english: 'अंग्रेजी',
  nepali: 'नेपाली',
  language: 'भाषा',
  name: 'नाम',
  time: 'समय',
  day: 'दिन',
  night: 'रात',
  week: 'हप्ता',
  month: 'महिना',
  year: 'वर्ष',
  people: 'मानिसहरू',
  person: 'व्यक्ति',
  friend: 'साथी',
  book: 'किताब',
  car: 'कार',
  road: 'बाटो',
  street: 'सडक',
  shop: 'पसल',
  market: 'बजार',
  restaurant: 'रेस्टुरेन्ट',
  hotel: 'होटल',
  airport: 'विमानस्थल',
  hospital: 'अस्पताल',
  school: 'विद्यालय',
  university: 'विश्वविद्यालय',
  office: 'कार्यालय',
  morning: 'बिहान',
  evening: 'साँझ',
  afternoon: 'दिउँसो',
  weather: 'मौसम',
  rain: 'वर्षा',
  snow: 'हिउँ',
  mountain: 'पहाड',
  river: 'नदी',
  lake: 'ताल',
  forest: 'जंगल',
  animal: 'जनावर',
  dog: 'कुकुर',
  cat: 'बिरालो',
  bird: 'चरा',
  fish: 'माछा',
  little: 'थोरै',
  bit: 'अलिकति',
  growled: 'गुर्रायो',
  growl: 'गुर्राउनु',
  barked: 'भुक्यो',
  bark: 'भुक्नु',
  cooper: 'कुपर',
  big: 'ठूलो',
  small: 'सानो',
  new: 'नयाँ',
  old: 'पुरानो',
  good: 'राम्रो',
  bad: 'नराम्रो',
  happy: 'खुशी',
  sad: 'दुखी',
  tired: 'थाकेको',
  sick: 'बिरामी',
  healthy: 'स्वस्थ',
  clean: 'सफा',
  dirty: 'फोहोर',
  fast: 'छिटो',
  slow: 'बिस्तारै',
  easy: 'सजिलो',
  hard: 'गाह्रो',
  free: 'निःशुल्क',
  busy: 'व्यस्त',
  ready: 'तयार',
  sure: 'निश्चित',
  maybe: 'हुनसक्छ',
  always: 'सधैं',
  never: 'कहिल्यै',
  often: 'बारम्बार',
  sometimes: 'कहिलेकाहीं',
  again: 'फेरि',
  also: 'पनि',
  only: 'मात्र',
  still: 'अझै',
  already: 'पहिल्यै',
  before: 'अघि',
  after: 'पछि',
  because: 'किनकि',
  if: 'यदि',
  when: 'जब',
  where: 'कहाँ',
  what: 'के',
  who: 'को',
  why: 'किन',
  how: 'कसरी',
  can: 'सक्नु',
  could: 'सक्थे',
  will: 'गर्नेछु',
  would: 'गर्नेथिएँ',
  should: 'पर्छ',
  must: 'पर्छ',
};

const NE_WORDS: Record<string, string> = Object.fromEntries(
  Object.entries(EN_WORDS)
    .filter(([, v]) => v)
    .map(([k, v]) => [v, k]),
);

function norm(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[?.!,;:]+$/g, '')
    .replace(/\s+/g, ' ');
}

/** Strip trailing punctuation; return [bare, punct]. */
function splitPunct(token: string): [string, string] {
  const bare = token.replace(/[?.!,;:]+$/g, '');
  return [bare, token.slice(bare.length)];
}

function bareToken(token: string): string {
  return splitPunct(token)[0].toLowerCase();
}

/** True when EN→NE output still contains leftover Latin words. */
function hasLatinLeftovers(text: string): boolean {
  return /[A-Za-z]/.test(text);
}

/** Roman Nepali → English (common traveler spellings). */
const ROMAN_NE_PHRASES: [string, string][] = [
  ['namaste', 'hello'],
  ['namaskar', 'hello'],
  ['dhanyabad', 'thank you'],
  ['dhanyavaad', 'thank you'],
  ['kripya', 'please'],
  ['kripaya', 'please'],
  ['maaf garnuhos', 'sorry'],
  ['hoina', 'no'],
  ['ho', 'yes'],
  ['thik cha', 'ok'],
  ['thik chha', 'ok'],
  ['kasto cha', 'how are you'],
  ['tapai lai kasto cha', 'how are you'],
  ['timi lai kasto cha', 'how are you'],
  ['ma thik chu', 'i am fine'],
  ['ma thik chhu', 'i am fine'],
  ['mero nam', 'my name is'],
  ['tapai ko nam ke ho', "what's your name"],
  ['swagat cha', 'welcome'],
  ['bida', 'goodbye'],
];

/** Phrase entries sorted longest-first for greedy compose. */
const EN_PHRASE_PARTS: { parts: string[]; ne: string }[] = [...PHRASES]
  .map(([en, ne]) => ({ parts: norm(en).split(' ').filter(Boolean), ne }))
  .filter((p) => p.parts.length > 0)
  .sort(
    (a, b) =>
      b.parts.length - a.parts.length ||
      b.parts.join(' ').length - a.parts.join(' ').length,
  );

function phraseLookup(text: string, direction: Direction): string | null {
  const n = norm(text);
  if (direction === 'ne-en') {
    for (const [roman, en] of ROMAN_NE_PHRASES) {
      if (norm(roman) === n) return en;
    }
  }
  for (const [en, ne] of PHRASES) {
    if (direction === 'en-ne' && norm(en) === n) return ne;
    if (direction === 'ne-en' && norm(ne) === n) return en;
  }
  // starts-with for "my name is X" — keep a short Latin name remainder only.
  if (direction === 'en-ne') {
    for (const [en, ne] of PHRASES) {
      if (en.length >= 8 && n.startsWith(norm(en))) {
        const rest = text.trim().slice(en.length).trim();
        if (!rest) return ne;
        if (/^[A-Za-z][A-Za-z.'\-]*$/.test(rest)) {
          return `${ne} ${rest}`;
        }
      }
    }
  }
  return null;
}

/**
 * Greedy left-to-right EN→NE: longest phrase match, then lexicon word.
 * Incomplete when any content token stays unknown — callers refuse mashups.
 */
function composeEnNe(text: string): {
  text: string;
  method: 'phrase' | 'lexicon';
  complete: boolean;
} {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) {
    return { text: '', method: 'phrase', complete: true };
  }

  const out: string[] = [];
  let i = 0;
  let usedPhrase = false;
  let usedLexicon = false;
  let incomplete = false;
  let trailingPunct = '';

  while (i < words.length) {
    let matched = false;
    for (const { parts, ne } of EN_PHRASE_PARTS) {
      if (i + parts.length > words.length) continue;
      const slice = words.slice(i, i + parts.length);
      const bares = slice.map(bareToken);
      if (bares.every((b, j) => b === parts[j])) {
        const [, punct] = splitPunct(slice[slice.length - 1]);
        out.push(ne + punct);
        i += parts.length;
        usedPhrase = true;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    const [bareRaw, punct] = splitPunct(words[i]);
    const bare = bareRaw.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(EN_WORDS, bare)) {
      const tr = EN_WORDS[bare];
      if (tr) out.push(tr + punct);
      else trailingPunct = punct || trailingPunct;
      usedLexicon = true;
      i += 1;
      continue;
    }

    // Unknown English token — do not paste into Nepali output.
    incomplete = true;
    i += 1;
  }

  const joined = out.filter(Boolean).join(' ') + trailingPunct;
  return {
    text: joined.trim(),
    method: usedPhrase && !usedLexicon ? 'phrase' : 'lexicon',
    complete: !incomplete,
  };
}

function wordTranslate(text: string, direction: Direction): string {
  if (direction === 'en-ne') {
    const composed = composeEnNe(text);
    // Never return English/Nepali mashups — incomplete guesses stay empty.
    if (!composed.complete || hasLatinLeftovers(composed.text)) return '';
    return composed.text;
  }
  // Nepali → English: split on spaces / Devanagari word boundaries
  const parts = text.trim().split(/\s+/);
  return parts
    .map((w) => {
      const bare = w.replace(/[?.!,;:]+$/g, '');
      const punct = w.slice(bare.length);
      const tr = NE_WORDS[bare];
      return (tr ?? w) + punct;
    })
    .join(' ');
}

export function detectDirection(text: string, preferred: Direction): Direction {
  if (DEVANAGARI.test(text)) return 'ne-en';
  if (looksLikeRomanNepali(text)) return 'ne-en';
  if (/[a-zA-Z]/.test(text)) return 'en-ne';
  return preferred;
}

export type TranslateResult = {
  text: string;
  method: 'phrase' | 'lexicon' | 'neural';
  direction: Direction;
};

export type TranslateOptions = {
  formality?: Formality;
  /** Applied to Nepali output (EN→NE). */
  script?: NepaliScript;
  /**
   * Conversation mode: never auto-detect opposite language.
   * Trust the speaker side so EN↔NE switching stays stable.
   */
  forcePreferred?: boolean;
};

/** Fully on-device. Never hits the network. */
export function translateOnDevice(
  text: string,
  preferred: Direction,
  formalityOrOpts: Formality | TranslateOptions = 'formal',
): TranslateResult {
  const opts: TranslateOptions =
    typeof formalityOrOpts === 'string'
      ? { formality: formalityOrOpts }
      : formalityOrOpts;
  const formality = opts.formality ?? 'formal';
  const script = opts.script ?? 'deva';

  const raw = (text || '').trim();
  if (!raw) {
    return { text: '', method: 'phrase', direction: preferred };
  }
  const direction = opts.forcePreferred
    ? preferred
    : detectDirection(raw, preferred);

  let out = '';
  let method: TranslateResult['method'] = 'phrase';

  const hit = phraseLookup(raw, direction);
  if (hit) {
    out = hit;
    method = 'phrase';
  } else if (direction === 'en-ne') {
    const composed = composeEnNe(raw);
    // Refuse Latin/Nepali mashups — incomplete free text yields no target.
    if (composed.complete && composed.text && !hasLatinLeftovers(composed.text)) {
      out = composed.text;
      method = composed.method;
    } else {
      out = '';
      method = 'lexicon';
    }
  } else {
    out = wordTranslate(raw, direction);
    method = 'lexicon';
  }

  if (direction === 'en-ne' && formality === 'informal') {
    out = applyInformal(out);
  }
  if (direction === 'en-ne') {
    out = formatNepaliScript(out, script);
  }
  return {
    text: out,
    method,
    direction,
  };
}

/**
 * Translate complete sentences separately (matches IndicTrans2 sentence unit),
 * then join. Remainder without terminal punctuation is still translated once.
 */
export function translateBySentences(
  text: string,
  preferred: Direction,
  opts: TranslateOptions = {},
): TranslateResult {
  const { complete, remainder } = splitSentences(text);
  const parts = remainder ? [...complete, remainder] : complete;
  if (parts.length <= 1) {
    return translateOnDevice(text, preferred, opts);
  }
  let direction = preferred;
  const out: string[] = [];
  let method: TranslateResult['method'] = 'phrase';
  for (const part of parts) {
    const r = translateOnDevice(part, direction, opts);
    direction = r.direction;
    if (r.method === 'lexicon') method = 'lexicon';
    if (r.text.trim()) out.push(r.text.trim());
  }
  return {
    text: out.join(' '),
    method,
    direction,
  };
}

export function sourceLabel(direction: Direction): string {
  return direction === 'en-ne' ? 'English' : 'Nepali';
}

export function targetLabel(direction: Direction): string {
  return direction === 'en-ne' ? 'Nepali' : 'English';
}

export { formatNepaliScript, looksLikeRomanNepali } from './romanize';
