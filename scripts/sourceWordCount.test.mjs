import assert from 'node:assert/strict';
import test from 'node:test';
import { countSourceWords, scheduledCreditsForWords } from './sourceWordCount.mjs';

test('counts English and Devanagari words on whitespace', () => {
  assert.equal(countSourceWords('one two three'), 3);
  assert.equal(countSourceWords('  नमस्ते   संसार  '), 2);
  assert.equal(countSourceWords(''), 0);
  assert.equal(countSourceWords('one two three four\n'), 4);
  assert.equal(countSourceWords('\n\n'), 0);
});

test('word-count tiers are 1, 2, and 3 credits', () => {
  assert.equal(scheduledCreditsForWords(0), 0);
  assert.equal(scheduledCreditsForWords(1), 1);
  assert.equal(scheduledCreditsForWords(4), 1);
  assert.equal(scheduledCreditsForWords(5), 2);
  assert.equal(scheduledCreditsForWords(6), 2);
  assert.equal(scheduledCreditsForWords(7), 3);
  assert.equal(scheduledCreditsForWords(24), 3);
  const four = Array.from({ length: 4 }, () => 'word').join(' ');
  const six = Array.from({ length: 6 }, () => 'शब्द').join(' ');
  const seven = Array.from({ length: 7 }, () => 'word').join(' ');
  assert.equal(scheduledCreditsForWords(countSourceWords(four)), 1);
  assert.equal(scheduledCreditsForWords(countSourceWords(six)), 2);
  assert.equal(scheduledCreditsForWords(countSourceWords(seven)), 3);
});
