import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  isSessionInactive,
  SESSION_INACTIVITY_MS,
  sessionInactiveNow,
  touchSessionActivity,
} from '../sessionExpiry';

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

  test('one account stamp does not expire a different account', async () => {
    await AsyncStorage.clear();
    await touchSessionActivity('user-a', start);
    await touchSessionActivity('user-b', start + SESSION_INACTIVITY_MS);
    expect(await sessionInactiveNow('user-a', start + SESSION_INACTIVITY_MS)).toBe(
      true,
    );
    expect(
      await sessionInactiveNow('user-b', start + SESSION_INACTIVITY_MS),
    ).toBe(false);
  });
});
