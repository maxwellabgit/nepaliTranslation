import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearCachedEntitlement,
  loadCachedEntitlement,
  saveCachedEntitlement,
} from '../entitlementCache';

describe('entitlementCache', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  test('round-trips cached entitlement', async () => {
    const value = {
      earnedAdFreeUntilMs: 5_000_000,
      lifetimeCredits: 7,
      version: 2,
      syncedAtMs: 1_000_000,
    };
    await saveCachedEntitlement(value);
    expect(await loadCachedEntitlement()).toEqual(value);
  });

  test('returns null for missing or invalid cache', async () => {
    expect(await loadCachedEntitlement()).toBeNull();
    await AsyncStorage.setItem('nepx.entitlement.v1', '{"version":"bad"}');
    expect(await loadCachedEntitlement()).toBeNull();
    await AsyncStorage.setItem('nepx.entitlement.v1', 'not-json');
    expect(await loadCachedEntitlement()).toBeNull();
  });

  test('clear removes stored entitlement', async () => {
    await saveCachedEntitlement({
      earnedAdFreeUntilMs: null,
      lifetimeCredits: 0,
      version: 0,
      syncedAtMs: 0,
    });
    await clearCachedEntitlement();
    expect(await loadCachedEntitlement()).toBeNull();
  });
});
