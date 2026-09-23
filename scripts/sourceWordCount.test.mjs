import assert from 'node:assert/strict';
import test from 'node:test';
import { countSourceWords, scheduledCreditsForWords } from './sourceWordCount.mjs';

test('counts English and Devanagari words on whitespace', () => {
  assert.equal(countSourceWords('one two three'), 3);
  assert.equal(countSourceWords('  नमस्ते   संसार  '), 2);
  assert.equal(countSourceWords(''), 0);
});

test('20 words is 2 credits and 21 words is 4', () => {
  const twenty = Array.from({ length: 20 }, () => 'word').join(' ');
  const twentyOne = Array.from({ length: 21 }, () => 'शब्द').join(' ');
  assert.equal(scheduledCreditsForWords(countSourceWords(twenty)), 2);
  assert.equal(scheduledCreditsForWords(countSourceWords(twentyOne)), 4);
  assert.equal(scheduledCreditsForWords(0), 2);
});
