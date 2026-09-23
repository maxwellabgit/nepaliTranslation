import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * G2 startup consent gate storage (device-local).
 *
 * Every user acknowledges Terms and Privacy before product surfaces.
 * 18+ is the signed-in contribution gate, not this startup record.
 *
 * When the user signs in, the client mirrors this record to `public.profiles`
 * via `service_record_startup_consent` so the same gate applies on other
 * devices.
 */

const KEY = 'neptranslate.startup_consent.v1';

export const STARTUP_CONSENT_VERSION = '2026-09-23.startup';

export type StartupConsent = {
  version: string;
  terms: boolean;
  privacy: boolean;
  age18Plus: boolean;
  accepted_at: string;
};

export async function loadStartupConsent(): Promise<StartupConsent | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StartupConsent;
    if (!parsed?.version) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function isStartupConsentCurrent(record: StartupConsent | null): boolean {
  if (!record) return false;
  return (
    record.version === STARTUP_CONSENT_VERSION &&
    record.terms === true &&
    record.privacy === true
  );
}

export async function saveStartupConsent(input: {
  terms: boolean;
  privacy: boolean;
  age18Plus: boolean;
}): Promise<StartupConsent> {
  const value: StartupConsent = {
    version: STARTUP_CONSENT_VERSION,
    terms: input.terms,
    privacy: input.privacy,
    age18Plus: input.age18Plus,
    accepted_at: new Date().toISOString(),
  };
  await AsyncStorage.setItem(KEY, JSON.stringify(value));
  return value;
}

export async function clearStartupConsent(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
