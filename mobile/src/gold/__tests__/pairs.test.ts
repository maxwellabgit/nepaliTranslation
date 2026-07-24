import { allReviewUnits, unitStats, unitsForLane, REVIEW_LANES } from '../pairs';
import { goldPack } from '../pack';

describe('gold review pairs', () => {
  it('exposes two review lanes', () => {
    expect(REVIEW_LANES.map((l) => l.id)).toEqual(['en_ne', 'ne_en']);
  });

  it('unitStats match pack size', () => {
    const s = unitStats();
    expect(s.total_items).toBe(goldPack.n_items);
    expect(s.total_units).toBe(s.en_ne + s.ne_en);
    expect(s.total_units).toBeLessThan(s.total_items);
    expect(s.total_units).toBeGreaterThan(200);
  });

  it('pairs EN→NE formal/informal on shared English', () => {
    const units = unitsForLane('en_ne');
    expect(units.length).toBeGreaterThan(100);
    const paired = units.filter((u) => u.left && u.right);
    expect(paired.length).toBeGreaterThan(100);
    for (const u of paired.slice(0, 20)) {
      expect(u.sharedLabel).toBe('English');
      expect(u.leftLabel).toMatch(/formal/i);
      expect(u.rightLabel).toMatch(/informal/i);
      expect(u.itemIds).toHaveLength(2);
    }
  });

  it('pairs NE→EN Deva/Roman on shared English reference', () => {
    const units = unitsForLane('ne_en');
    const paired = units.filter((u) => u.left && u.right);
    expect(paired.length).toBeGreaterThan(100);
    for (const u of paired.slice(0, 20)) {
      expect(u.leftLabel).toMatch(/Devanagari/i);
      expect(u.rightLabel).toMatch(/Roman/i);
    }
  });

  it('keeps unique unit ids across allReviewUnits', () => {
    const all = allReviewUnits();
    const ids = all.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('allows trailing-punct English to pair', () => {
    const units = unitsForLane('en_ne');
    const hello = units.find(
      (u) => u.shared.replace(/[?.!]+$/i, '').toLowerCase() === 'hello',
    );
    expect(hello).toBeTruthy();
    expect(hello!.left || hello!.right).toBeTruthy();
  });
});
