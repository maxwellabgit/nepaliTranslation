import AsyncStorage from '@react-native-async-storage/async-storage';
import { CONTRIBUTION_CONSENT_VERSION } from '../features/auth/consent';

const KEY = 'neptranslate.contribution_consent.v1';

export type LocalConsent = {
  consent_version: string;
  age_confirmed: boolean;
  saved_at: string;
};

export async function loadLocalConsent(): Promise<LocalConsent | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalConsent;
    if (!parsed?.consent_version) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveLocalConsent(ageConfirmed: boolean): Promise<LocalConsent> {
  const value: LocalConsent = {
    consent_version: CONTRIBUTION_CONSENT_VERSION,
    age_confirmed: ageConfirmed,
    saved_at: new Date().toISOString(),
  };
  await AsyncStorage.setItem(KEY, JSON.stringify(value));
  return value;
}

export async function clearLocalConsent(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
