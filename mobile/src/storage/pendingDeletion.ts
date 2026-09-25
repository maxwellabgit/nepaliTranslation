import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'neptranslate.pendingDeletionDueAt';

export async function savePendingDeletionDue(iso: string): Promise<void> {
  await AsyncStorage.setItem(KEY, iso);
}

export async function loadPendingDeletionDue(): Promise<string | null> {
  return AsyncStorage.getItem(KEY);
}

export async function clearPendingDeletionDue(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}

/**
 * Completion is a server timestamp on the deletion request.
 * A due date, even one that has passed, is only the deadline.
 */
export function isServerDeletionComplete(completedAt: string | null | undefined): boolean {
  if (!completedAt) return false;
  return Number.isFinite(Date.parse(completedAt));
}
