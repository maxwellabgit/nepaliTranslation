import { isSessionInactive, SESSION_INACTIVITY_MS } from '../sessionExpiry';

describe('session inactivity', () => {
  const start = Date.parse('2026-01-01T00:00:00.000Z');

  test('a short simulated timeout expires without waiting 30 days', () => {
    expect(isSessionInactive(start, start + 1_000, 1_000)).toBe(true);
    expect(isSessionInactive(start, start + 999, 1_000)).toBe(false);
  });

  test('the production window is 30 days', () => {
    expect(isSessionInactive(start, start + SESSION_INACTIVITY_MS - 1)).toBe(false);
    expect(isSessionInactive(start, start + SESSION_INACTIVITY_MS)).toBe(true);
  });
});
