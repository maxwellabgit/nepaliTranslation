import assert from 'node:assert/strict';
import test from 'node:test';
import { manifestReady } from './exclusionManifest.mjs';

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

test('a positive exposure count with no hashes fails closed', () => {
  assert.equal(manifestReady({
    exposure_count: 2,
    excluded: [],
    source_hashes: [],
    target_hashes: [],
  }), false);
});
