#!/usr/bin/env node
/**
 * Data-preserving upgrade proof.
 *
 *   npx supabase db reset --version 20260923220000
 *   node scripts/prove_upgrade_path.mjs --seed
 *   npx supabase migration up --local
 *   node scripts/prove_upgrade_path.mjs --assert
 *
 * --seed fails if later columns already exist.
 * --assert fails if pre-fix accounts, media, review rows, or the deletion
 * deadline were rewritten. It does not prove executor retry.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2];
const file =
  mode === '--seed'
    ? resolve(root, 'supabase/tests/upgrade/pre_fix_seed.sql')
    : mode === '--assert'
      ? resolve(root, 'supabase/tests/upgrade/post_fix_assert.sql')
      : null;

if (!file) {
  console.error('usage: node scripts/prove_upgrade_path.mjs --seed|--assert');
  process.exit(2);
}

const sql = readFileSync(file);
const run = spawnSync(
  'docker',
  [
    'exec',
    '-i',
    'supabase_db_neptranslate',
    'psql',
    '-U',
    'postgres',
    '-d',
    'postgres',
    '-v',
    'ON_ERROR_STOP=1',
    '-f',
    '-',
  ],
  { input: sql, stdio: ['pipe', 'inherit', 'inherit'] },
);

if (run.status !== 0) {
  console.error(`prove_upgrade_path: ${mode} failed`);
  process.exit(run.status ?? 1);
}
console.log(`prove_upgrade_path: ${mode} ok`);
