import assert from 'node:assert/strict';
import test from 'node:test';
import { filterExportRows, manifestReady } from './exclusionManifest.mjs';

test('an empty manifest without a snapshot is not proof', () => {
  assert.equal(manifestReady({ excluded: [] }), false);
  assert.equal(manifestReady({}), false);
});

test('a declared zero-exposure snapshot is ready to scan', () => {
  assert.equal(manifestReady({
    exposure_count: 0,
    excluded: [],
    source_hashes: [],
    target_hashes: [],
  }), true);
});

test('an exposed source and target are absent from the export', () => {
  const manifest = {
    exposure_count: 2,
    excluded: ['composite-exposed'],
    source_hashes: ['source-exposed'],
    target_hashes: ['target-exposed'],
  };
  const rows = [
    { hash: 'composite-exposed', sourceHash: 'source-private', targetHash: 'target-private' },
    { hash: 'composite-ok', sourceHash: 'source-exposed', targetHash: 'target-private' },
    { hash: 'composite-ok-2', sourceHash: 'source-private', targetHash: 'target-exposed' },
    { hash: 'composite-safe', sourceHash: 'source-private', targetHash: 'target-private' },
  ];
  const { kept, dropped } = filterExportRows(rows, manifest);
  assert.deepEqual(kept.map((row) => row.hash), ['composite-safe']);
  assert.equal(dropped.length, 3);
  assert.equal(manifest.exposure_count > 0, true);
  assert.equal(manifest.source_hashes.length + manifest.target_hashes.length > 0, true);
});

test('a positive exposure count with no hashes fails closed', () => {
  assert.equal(manifestReady({
    exposure_count: 2,
    excluded: [],
    source_hashes: [],
    target_hashes: [],
  }), false);
});
