
import { readFileSync } from 'node:fs';
import { formatNepaliScript } from '../../../mobile/src/mt/romanize.ts';

const raw = readFileSync(0, 'utf8').split(/\n/).filter(Boolean);
for (const line of raw) {
  const row = JSON.parse(line) as { devanagari: string; devanagari_informal: string };
  const roman = row.devanagari ? formatNepaliScript(row.devanagari, 'roman') : '';
  const romanInformal = row.devanagari_informal
    ? formatNepaliScript(row.devanagari_informal, 'roman')
    : '';
  process.stdout.write(JSON.stringify({ roman, roman_informal: romanInformal }) + '\n');
}
