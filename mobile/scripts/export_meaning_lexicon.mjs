#!/usr/bin/env node
/**
 * Build mobile/src/mt/generated/meaningLexicon.json from the meaning bank.
 * Runs on EAS pre-install and locally before verify. Do not commit the output.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MOBILE = path.resolve(__dirname, '..');
const BANK_CANDIDATES = [
  path.join(MOBILE, 'assets', 'data', 'meaning_bank.jsonl'),
  path.join(MOBILE, '..', 'training', 'data', 'meaning_bank.jsonl'),
];
const BANK = BANK_CANDIDATES.find((p) => fs.existsSync(p));
const OUT = path.join(MOBILE, 'src', 'mt', 'generated', 'meaningLexicon.json');

const DEVANAGARI = /[\u0900-\u097F]/;
const LATIN_WORD = /^[a-z]+$/;
const PUNCT = /[?.!,;:।]+$/u;

function norm(s) {
  return (s || '')
    .trim()
    .toLowerCase()
    .replace(PUNCT, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function variants(roman) {
  const s = norm(roman);
  if (!s) return [];
  const out = new Set([s]);
  out.add(s.replaceAll('chha', 'cha'));
  out.add(s.replaceAll('chhu', 'chu'));
  out.add(s.replaceAll('nuhunchha', 'nuhuncha'));
  out.add(s.replace(' lai ', 'lai '));
  out.add(s.replaceAll('tapaile', 'tapai le'));
  out.add(s.replaceAll('tapai le', 'tapaile'));
  out.add(s.replaceAll('timile', 'timi le'));
  out.add(s.replaceAll('timi le', 'timile'));
  return [...out].map((x) => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

const WORD_EXCEPTIONS = {
  tapai: 'तपाईं',
  tapaai: 'तपाईं',
  tapayi: 'तपाईं',
  timi: 'तिमी',
  malai: 'मलाई',
  mero: 'मेरो',
  hamro: 'हाम्रो',
  kasto: 'कस्तो',
  kaha: 'कहाँ',
  kahaa: 'कहाँ',
  yaha: 'यहाँ',
  yahaa: 'यहाँ',
  tyaha: 'त्यहाँ',
  namaste: 'नमस्ते',
  namaskar: 'नमस्कार',
  dhanyabad: 'धन्यवाद',
  dhanyavaad: 'धन्यवाद',
  garnuhos: 'गर्नुहोस्',
  dinuhos: 'दिनुहोस्',
  bolnuhunchha: 'बोल्नुहुन्छ',
  bolnuhuncha: 'बोल्नुहुन्छ',
  chahiyo: 'चाहियो',
  chahinchha: 'चाहिन्छ',
  bujhina: 'बुझिनँ',
  shauchalaya: 'शौचालय',
  sauchalaya: 'शौचालय',
  pani: 'पानी',
  ramro: 'राम्रो',
  thik: 'ठिक',
  madat: 'मद्दत',
  angreji: 'अंग्रेजी',
  angrezi: 'अंग्रेजी',
  nepali: 'नेपाली',
  kati: 'कति',
  hotel: 'होटल',
  bazar: 'बजार',
  bazaar: 'बजार',
  maile: 'मैले',
  tapailai: 'तपाईंलाई',
  timilai: 'तिमीलाई',
  cha: 'छ',
  chha: 'छ',
  chu: 'छु',
  chhu: 'छु',
  ho: 'हो',
  ram: 'राम',
  naam: 'नाम',
  nam: 'नाम',
};

function main() {
  if (!BANK) {
    throw new Error(
      'meaning_bank.jsonl not found (looked in assets/data and ../../training/data)',
    );
  }
  const rows = fs
    .readFileSync(BANK, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));

  const enToNe = {};
  const neToEn = {};
  const romanToEn = {};
  const wordVotes = {};

  const addWord = (rom, deva) => {
    const r = norm(rom);
    const d = (deva || '').replace(PUNCT, '').trim();
    if (!LATIN_WORD.test(r) || !DEVANAGARI.test(d) || r.length < 2) return;
    wordVotes[r] ??= {};
    wordVotes[r][d] = (wordVotes[r][d] || 0) + 1;
  };

  for (const row of rows) {
    const en = (row.english || '').trim();
    const neF = (row.ne_formal || '').trim();
    const neI = (row.ne_informal || '').trim();
    const rf = (row.roman_formal || '').trim();
    const ri = (row.roman_informal || '').trim();
    if (!en || !neF) continue;

    const enKey = norm(en);
    if (enKey && !enToNe[enKey]) enToNe[enKey] = neF;

    for (const ne of [neF, neI]) {
      const k = norm(ne);
      if (k && DEVANAGARI.test(ne) && !neToEn[k]) neToEn[k] = en;
    }

    for (const [roman, deva] of [
      [rf, neF],
      [ri, neI || neF],
    ]) {
      if (!roman) continue;
      for (const key of variants(roman)) {
        if (!romanToEn[key]) romanToEn[key] = en;
      }
      const rToks = roman
        .toLowerCase()
        .split(/\s+/)
        .map((t) => t.replace(PUNCT, ''))
        .filter(Boolean);
      const dToks = deva
        .split(/\s+/)
        .map((t) => t.replace(PUNCT, ''))
        .filter(Boolean);
      if (rToks.length === dToks.length && rToks.length >= 1 && rToks.length <= 12) {
        for (let i = 0; i < rToks.length; i++) addWord(rToks[i], dToks[i]);
      }
    }
  }

  const romanWords = { ...WORD_EXCEPTIONS };
  for (const [w, votes] of Object.entries(wordVotes)) {
    let best = '',
      n = 0;
    for (const [d, c] of Object.entries(votes)) {
      if (c > n) {
        best = d;
        n = c;
      }
    }
    if (best && !romanWords[w]) romanWords[w] = best;
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ enToNe, neToEn, romanToEn, romanWords }));
  const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
  console.log(
    `[lexicon] wrote ${path.relative(MOBILE, OUT)} (${kb} KB) en=${Object.keys(enToNe).length} ne=${Object.keys(neToEn).length} romanSent=${Object.keys(romanToEn).length} romanWords=${Object.keys(romanWords).length}`,
  );
}

main();
