import { isServerDeletionComplete } from '../pendingDeletion';

describe('deletion completion', () => {
  test('a passed due date is not completion', () => {
    expect(isServerDeletionComplete(null)).toBe(false);
    expect(isServerDeletionComplete('')).toBe(false);
    expect(isServerDeletionComplete('not-a-date')).toBe(false);
  });

  test('only a server completion timestamp counts', () => {
    expect(isServerDeletionComplete('2026-10-01T00:00:00.000Z')).toBe(true);
  });
});
