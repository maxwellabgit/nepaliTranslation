#!/usr/bin/env node
/**
 * Coverage ratchet for critical beta groups.
 * Records a baseline on first green run; later runs fail on any decrease.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(__dirname, '..');
const baselinePath = path.join(
  mobileRoot,
  'coverage',
  'beta-critical-baseline.json',
);

const GROUPS = [
  'src/features/auth/',
  'src/features/contribution/',
  'src/features/entitlements/',
  'src/features/ads/',
  'src/services/contributionSync.ts',
];

function runCoverage() {
  const result = spawnSync(
    'npx',
    [
      'jest',
      '--coverage',
      '--coverageReporters=json-summary',
      '--runInBand',
      '--testPathIgnorePatterns=integration-test',
    ],
    {
      cwd: mobileRoot,
      encoding: 'utf8',
      shell: true,
      env: { ...process.env, CI: '1' },
    },
  );
  if (result.status !== 0) {
    process.stderr.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    process.exit(result.status ?? 1);
  }
}

function loadSummary() {
  const summaryPath = path.join(
    mobileRoot,
    'coverage',
    'coverage-summary.json',
  );
  if (!fs.existsSync(summaryPath)) {
    throw new Error(`missing ${summaryPath}`);
  }
  return JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
}

function groupStats(summary) {
  const out = {};
  for (const group of GROUPS) {
    let statements = { covered: 0, total: 0 };
    let branches = { covered: 0, total: 0 };
    let lines = { covered: 0, total: 0 };
    for (const [file, data] of Object.entries(summary)) {
      if (file === 'total') continue;
      const norm = file.replace(/\\/g, '/');
      if (!norm.includes(group.replace(/\\/g, '/'))) continue;
      statements.covered += data.statements.covered;
      statements.total += data.statements.total;
      branches.covered += data.branches.covered;
      branches.total += data.branches.total;
      lines.covered += data.lines.covered;
      lines.total += data.lines.total;
    }
    const pct = (c, t) => (t === 0 ? 100 : (100 * c) / t);
    out[group] = {
      statements: pct(statements.covered, statements.total),
      branches: pct(branches.covered, branches.total),
      lines: pct(lines.covered, lines.total),
      totals: { statements, branches, lines },
    };
  }
  return out;
}

function round(n) {
  return Math.round(n * 100) / 100;
}

runCoverage();
const summary = loadSummary();
const current = groupStats(summary);
const rounded = Object.fromEntries(
  Object.entries(current).map(([k, v]) => [
    k,
    {
      statements: round(v.statements),
      branches: round(v.branches),
      lines: round(v.lines),
    },
  ]),
);

fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
if (!fs.existsSync(baselinePath)) {
  fs.writeFileSync(baselinePath, `${JSON.stringify(rounded, null, 2)}\n`);
  console.log(`Wrote coverage baseline to ${baselinePath}`);
  console.log(JSON.stringify(rounded, null, 2));
  process.exit(0);
}

const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
let failed = false;
for (const group of GROUPS) {
  const b = baseline[group];
  const c = rounded[group];
  if (!b || !c) {
    console.error(`Missing group ${group}`);
    failed = true;
    continue;
  }
  for (const metric of ['statements', 'branches', 'lines']) {
    if (c[metric] + 0.01 < b[metric]) {
      console.error(
        `Coverage regression ${group} ${metric}: ${c[metric]} < baseline ${b[metric]}`,
      );
      failed = true;
    }
  }
}

console.log('Current critical coverage:');
console.log(JSON.stringify(rounded, null, 2));
if (failed) process.exit(1);
console.log('Coverage ratchet OK (no decrease vs baseline).');
