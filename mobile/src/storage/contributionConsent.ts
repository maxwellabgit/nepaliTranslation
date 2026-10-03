import AsyncStorage from '@react-native-async-storage/async-storage';
import { CONTRIBUTION_CONSENT_VERSION } from '../features/auth/consent';
import { sessionInactiveNow } from '../features/auth/sessionExpiry';
import { permissionMutation } from './permissionTransactions';
import { readPendingDeletionUnserialized } from './pendingDeletion';
const KEY = 'neptranslate.contribution_consent.v1';
const IDENTITY_KEY = 'neptranslate.private_identity.v1';
export type LocalConsent = {
  consent_version: string; age_confirmed: boolean; saved_at: string;
  owner_id?: string;
};
export async function loadLocalConsent(ownerId?: string | null): Promise<LocalConsent | null> {
  if (ownerId === null) return null;
  try {
    return await permissionMutation(async () => {
      const raw = await AsyncStorage.getItem(KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as LocalConsent;
      if (!parsed?.consent_version) return null;
      if (ownerId) {
        const known = await AsyncStorage.getItem(IDENTITY_KEY);
        const deletion = await readPendingDeletionUnserialized(ownerId);
        if (parsed.owner_id !== ownerId || (known && known !== ownerId) || (deletion && !deletion.completedAt) || await sessionInactiveNow(ownerId)) return null;
      }
      return parsed;
    });
  } catch { return null; }
}
/** No-owner overload is legacy fixture/local-only compatibility. It never passes
 * an owner-bound upload check. Product consent always supplies its JWT subject. */
export function saveLocalConsent(ageConfirmed: boolean): Promise<LocalConsent>;
export function saveLocalConsent(ageConfirmed: boolean, ownerId: string, guard?: () => boolean): Promise<LocalConsent | null>;
export function saveLocalConsent(ageConfirmed: boolean, ownerId?: string, guard?: () => boolean): Promise<LocalConsent | null> {
  return permissionMutation(async () => {
    if (ownerId) {
      const known = await AsyncStorage.getItem(IDENTITY_KEY);
      const pending = await readPendingDeletionUnserialized(ownerId);
      if ((known && known !== ownerId) || (pending && !pending.completedAt) || (guard && !guard())) return null;
    }
    const value: LocalConsent = { consent_version: CONTRIBUTION_CONSENT_VERSION,
      age_confirmed: ageConfirmed, saved_at: new Date().toISOString(), ...(ownerId ? { owner_id: ownerId } : {}) };
    await AsyncStorage.setItem(KEY, JSON.stringify(value));
    // A UI operation token may change during the storage write. Remove this exact
    // revision before releasing the lock so it cannot resurrect an opt-in.
    const currentOwner = ownerId ? await AsyncStorage.getItem(IDENTITY_KEY) : null;
    if ((guard && !guard()) || (ownerId && currentOwner && currentOwner !== ownerId)) {
      await AsyncStorage.removeItem(KEY); return null;
    }
    return value;
  });
}
export async function clearLocalConsent(ownerId?: string): Promise<void> {
  return permissionMutation(async () => {
    if (ownerId) {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as LocalConsent;
        if (parsed.owner_id && parsed.owner_id !== ownerId) return;
      }
    }
    await AsyncStorage.removeItem(KEY);
  });
}
