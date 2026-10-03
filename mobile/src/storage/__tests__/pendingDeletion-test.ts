import AsyncStorage from '@react-native-async-storage/async-storage';
import { isServerDeletionComplete, savePendingDeletionIntent, savePendingDeletionDue, loadPendingDeletion, markPendingDeletionComplete } from '../pendingDeletion';

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

test('deletion intent and deadlines are durable per owner and legacy unowned deadlines are ignored', async () => {
  await AsyncStorage.clear();
  await AsyncStorage.setItem('neptranslate.pendingDeletionDueAt', '2026-11-01T00:00:00Z');
  expect(await loadPendingDeletion('new-owner')).toBeNull();
  const original = await savePendingDeletionIntent('owner-A');
  await savePendingDeletionDue('owner-A', '2026-11-01T00:00:00Z');
  expect(await loadPendingDeletion('owner-A')).toEqual({ ...original, dueAt: '2026-11-01T00:00:00Z' });
  expect(await loadPendingDeletion('owner-B')).toBeNull();
  await markPendingDeletionComplete('owner-A', original.requestedAt);
  expect((await loadPendingDeletion('owner-A'))?.completedAt).toBe(original.requestedAt);
});
