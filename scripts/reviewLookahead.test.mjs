import assert from 'node:assert/strict';
import test from 'node:test';
import { nyDateKey, planLookahead } from './reviewLookahead.mjs';

test('spring-forward and fall-back still have one New York calendar date', () => {
  const spring = new Date('2026-03-08T07:30:00.000Z');
  const fall = new Date('2026-11-01T05:30:00.000Z');
  assert.equal(nyDateKey(spring), '2026-03-08');
  assert.equal(nyDateKey(fall), '2026-11-01');
});

test('does not enable public review before 14 planned days', () => {
  const cohort = Array.from({ length: 100 }, (_, i) => ({ id: `old-${i}` }));
  const short = planLookahead({
    cohort,
    horizonDays: 10,
    startDate: '2026-09-23',
  });
  assert.equal(short.enabled, false);
  assert.equal(short.horizon, 10);
});

test('new imports do not reshuffle already planned days', () => {
  const existing = [{ date: '2026-09-24', itemIds: ['kept'] }];
  const result = planLookahead({
    existingDays: existing,
    cohort: [{ id: 'kept' }, { id: 'new-1' }],
    horizonDays: 2,
    startDate: '2026-09-23',
    perDay: 1,
  });
  assert.deepEqual(result.days[0], { date: '2026-09-24', itemIds: ['kept'] });
  assert.equal(result.days[1].itemIds.includes('kept'), false);
});

test('partial inventory does not duplicate an item to fill ten', () => {
  const result = planLookahead({
    cohort: [{ id: 'only' }],
    horizonDays: 1,
    minEnableDays: 1,
    startDate: '2026-09-23',
    perDay: 10,
  });
  assert.deepEqual(result.days[0].itemIds, ['only']);
});
