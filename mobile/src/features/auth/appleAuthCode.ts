import AsyncStorage from '@react-native-async-storage/async-storage';

function storageKey(userId: string): string {
  return `neptranslate.apple-authorization-code.${userId}`;
}

/** Kept on device only. Never sent except to delete-account. */
export async function saveAppleAuthorizationCode(
  userId: string,
  authorizationCode: string,
): Promise<void> {
  if (!userId || authorizationCode.length < 8) return;
  await AsyncStorage.setItem(storageKey(userId), authorizationCode);
}

export async function loadAppleAuthorizationCode(
  userId: string,
): Promise<string | null> {
  if (!userId) return null;
  return AsyncStorage.getItem(storageKey(userId));
}

export async function clearAppleAuthorizationCode(userId: string): Promise<void> {
  if (!userId) return;
  await AsyncStorage.removeItem(storageKey(userId));
}
