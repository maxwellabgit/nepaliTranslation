/**
 * Surgical punctuation clean for training and benchmark text.
 * Removes spaces before commas and periods. A roman "|" becomes a period
 * only when the paired input already ends with a period. Gold is untouched.
 * Files are rewritten only when the text actually changes.
 */
import fs from 'fs';
import path from 'path';

const SKIP = /(?:^|[\\/])gold(?:[\\/]|$)|cleaning_results/;

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (SKIP.test(full)) continue;
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(jsonl|json|csv)$/.test(name)) out.push(full);
  }
  return out;
}

function stripSpaceBeforePunct(value) {
  return value.replace(/ +([.,])/g, '$1');
}

function pairedInput(obj) {
  for (const key of ['english', 'en', 'eng_Latn', 'input']) {
    if (typeof obj[key] === 'string') return obj[key];
  }
  const direction = String(obj.direction || '');
  const kind = `${obj.kind || ''} ${obj.register || ''}`;
  if (direction.startsWith('ne') || /roman/i.test(kind)) {
    return typeof obj.tgt === 'string' ? obj.tgt : '';
  }
  return typeof obj.src === 'string' ? obj.src : '';
}

function fixRoman(roman, input) {
  if (!roman.includes('|')) return stripSpaceBeforePunct(roman);
  const endedWithPipe = roman.trimEnd().endsWith('|');
  let out = stripSpaceBeforePunct(roman.replace(/\|/g, '')).replace(/ +/g, ' ').trim();
  const wantsPeriod = String(input).trimEnd().endsWith('.');
  if (endedWithPipe && wantsPeriod && out && !/[.?!]$/.test(out)) out += '.';
  return out;
}

function cleanLine(line, stats) {
  if (!line.includes('|') || !/roman/i.test(line)) return stripSpaceBeforePunct(line);
  try {
    const obj = JSON.parse(line);
    const input = pairedInput(obj);
    let changed = false;
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value !== 'string') continue;
      const next = /roman/i.test(key) || (key === 'src' && /roman/i.test(`${obj.kind || ''} ${obj.register || ''}`))
        ? fixRoman(value, input)
        : stripSpaceBeforePunct(value);
      if (next !== value) {
        obj[key] = next;
        changed = true;
        if (value.includes('|')) stats.pipes += 1;
      }
    }
    if (!changed) return stripSpaceBeforePunct(line);
    stats.fields += 1;
    return JSON.stringify(obj);
  } catch {
    return stripSpaceBeforePunct(line);
  }
}

function parseCsv(text) {
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

const changed = [];
for (const file of [...walk('training/data'), ...walk('benchmarks/data'), ...walk('datasets/sheets')]) {
  const before = fs.readFileSync(file, 'utf8');
  const stats = { fields: 0, pipes: 0 };
  const eol = before.endsWith('\n');
  const lines = before.split('\n');
  const next = lines.map((line) => cleanLine(line, stats));
  let after = next.join('\n');
  if (eol && !after.endsWith('\n')) after += '\n';
  if (after !== before) {
    fs.writeFileSync(file, after);
    changed.push({ file, ...stats });
  }
}
console.log('CHANGED', changed.length);
for (const row of changed) console.log(`${row.fields}\tpipes ${row.pipes}\t${row.file}`);

const fourSets = [
  ['training/data/meaning_bank.jsonl', ['ne_formal', 'ne_informal', 'roman_formal', 'roman_informal']],
  ['training/data/improved/meaning_review.csv', ['ne_formal', 'ne_informal', 'roman_formal', 'roman_informal']],
  ['training/data/sheet50/training_set.csv', ['devanagari', 'devanagari_informal', 'roman', 'roman_informal']],
  ['training/data/model_fill_suggestions/model_fill_suggestions.csv', ['devanagari', 'devanagari_informal', 'roman', 'roman_informal']],
];
console.log('FILL');
for (const [file, columns] of fourSets) {
  if (file.endsWith('.jsonl')) {
    const rows = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
    const empty = Object.fromEntries(columns.map((name) => [name, 0]));
    for (const row of rows) for (const name of columns) if (!String(row[name] ?? '').trim()) empty[name] += 1;
    console.log(JSON.stringify({ file, rows: rows.length, empty }));
  } else {
    const rows = parseCsv(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
    const header = rows[0];
    const empty = Object.fromEntries(columns.map((name) => [name, 0]));
    const index = Object.fromEntries(columns.map((name) => [name, header.indexOf(name)]));
    for (const row of rows.slice(1)) {
      for (const name of columns) if (!(row[index[name]] ?? '').trim()) empty[name] += 1;
    }
    console.log(JSON.stringify({ file, rows: rows.length - 1, empty }));
  }
}
