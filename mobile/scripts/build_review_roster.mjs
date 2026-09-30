/**
 * Line the review-pool CSV into complete days: 10 meanings, three categories.
 * Formal Devanagari and formal Roman are the Nepali sources. Informal rows
 * stay in the CSV and are not a second day.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const csvPath = path.join(root, 'datasets', 'sheets', 'review_pool.csv');
const outPath = path.join(
  root,
  'mobile',
  'src',
  'features',
  'contribution',
  'reviewRoster.ts',
);

function parse(text) {
  const rows = [];
  let row = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(cur);
      cur = '';
    } else if (c === '\n') {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = '';
    } else if (c !== '\r') cur += c;
  }
  if (cur.length || row.length) {
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

const text = fs.readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, '');
const rows = parse(text);
const header = rows[0].map((cell) => cell.trim());
const col = Object.fromEntries(header.map((name, index) => [name, index]));
const byId = new Map();
for (const row of rows.slice(1)) {
  if (row.length < 5) continue;
  const id = (row[col.sample_id] ?? '').trim();
  if (!id) continue;
  if (!byId.has(id)) {
    byId.set(id, { id, english: (row[col.input] ?? '').trim(), deva: '', roman: '' });
  }
  const rec = byId.get(id);
  const script = (row[col.script] ?? '').trim();
  const register = (row[col.register] ?? '').trim();
  const output = (row[col.output] ?? '').trim();
  if (script === 'devanagari' && (register === 'formal' || !rec.deva)) rec.deva = output;
  if (script === 'roman' && (register === 'formal' || !rec.roman)) rec.roman = output;
}
const entries = [...byId.values()].filter((entry) => entry.english && entry.deva && entry.roman);
const days = [];
for (let i = 0; i + 10 <= entries.length; i += 10) days.push(entries.slice(i, i + 10));
const body =
  '/* Generated from datasets/sheets/review_pool.csv. Do not edit by hand. */\n' +
  'export type RosterMeaning = { id: string; english: string; deva: string; roman: string };\n' +
  `export const REVIEW_DAYS: RosterMeaning[][] = ${JSON.stringify(days)};\n`;
fs.writeFileSync(outPath, body);
console.log(`days ${days.length} meanings ${days.length * 10} skipped ${entries.length - days.length * 10}`);
