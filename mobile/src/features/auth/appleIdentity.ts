import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

/** SecureStore key for the stable Apple user identifier for a Supabase user. */
function secureKey(userId: string): string {
  return `neptranslate.apple-user.${userId}`;
}

/** Legacy AsyncStorage key that held short-lived authorization codes (never reuse). */
function legacyAuthCodeKey(userId: string): string {
  return `neptranslate.apple-authorization-code.${userId}`;
}

/**
 * Persist only the stable Apple user identifier needed for refreshAsync.
 * Never store short-lived authorization codes.
 */
export async function saveAppleUserId(
  userId: string,
  appleUserId: string,
): Promise<void> {
  if (!userId || !appleUserId) return;
  await SecureStore.setItemAsync(secureKey(userId), appleUserId);
  // Drop any legacy auth-code residue so deletion cannot reuse an expired code.
  await AsyncStorage.removeItem(legacyAuthCodeKey(userId));
}

export async function loadAppleUserId(userId: string): Promise<string | null> {
  if (!userId) return null;
  try {
    return await SecureStore.getItemAsync(secureKey(userId));
  } catch {
    return null;
  }
}

export async function clearAppleIdentity(userId: string): Promise<void> {
  if (!userId) return;
  try {
    await SecureStore.deleteItemAsync(secureKey(userId));
  } catch {
    // SecureStore may throw when the item is already gone.
  }
  await AsyncStorage.removeItem(legacyAuthCodeKey(userId));
}

/** True when a value looks like a short-lived Apple authorization code store — forbidden. */
export function isForbiddenAuthorizationCodeStorage(key: string): boolean {
  return key.includes('apple-authorization-code');
}
