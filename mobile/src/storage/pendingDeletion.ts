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

/** True when a scheduled deletion date has passed (guest completion banner). */
export function isDeletionDueComplete(iso: string | null, nowMs = Date.now()): boolean {
  if (!iso) return false;
  const due = Date.parse(iso);
  return Number.isFinite(due) && due <= nowMs;
}
