import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  isStartupConsentCurrent,
  loadStartupConsent,
  saveStartupConsent,
  STARTUP_CONSENT_VERSION,
  clearStartupConsent,
} from '../startupConsent';

describe('startupConsent storage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test('empty storage returns null and gate is not current', async () => {
    expect(await loadStartupConsent()).toBeNull();
    expect(isStartupConsentCurrent(null)).toBe(false);
  });

  test('save + reload round-trips T&C / Privacy / 18+ acknowledgement', async () => {
    const saved = await saveStartupConsent({
      terms: true,
      privacy: true,
      age18Plus: true,
    });
    expect(saved.version).toBe(STARTUP_CONSENT_VERSION);
    expect(saved.terms).toBe(true);
    expect(saved.privacy).toBe(true);
    expect(saved.age18Plus).toBe(true);
    const loaded = await loadStartupConsent();
    expect(loaded).not.toBeNull();
    expect(isStartupConsentCurrent(loaded)).toBe(true);
  });

  test('gate rejects when any of the three is unchecked', () => {
    const now = new Date().toISOString();
    expect(
      isStartupConsentCurrent({
        version: STARTUP_CONSENT_VERSION,
        terms: true,
        privacy: false,
        age18Plus: true,
        accepted_at: now,
      }),
    ).toBe(false);
    expect(
      isStartupConsentCurrent({
        version: STARTUP_CONSENT_VERSION,
        terms: true,
        privacy: true,
        age18Plus: false,
        accepted_at: now,
      }),
    ).toBe(false);
    expect(
      isStartupConsentCurrent({
        version: STARTUP_CONSENT_VERSION,
        terms: false,
        privacy: true,
        age18Plus: true,
        accepted_at: now,
      }),
    ).toBe(false);
  });

  test('older version forces re-acknowledgement', () => {
    expect(
      isStartupConsentCurrent({
        version: '1900-01-01.old',
        terms: true,
        privacy: true,
        age18Plus: true,
        accepted_at: new Date().toISOString(),
      }),
    ).toBe(false);
  });

  test('clear removes the record', async () => {
    await saveStartupConsent({ terms: true, privacy: true, age18Plus: true });
    await clearStartupConsent();
    expect(await loadStartupConsent()).toBeNull();
  });
});
