import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearLocalConsent, loadLocalConsent, saveLocalConsent } from '../contributionConsent';
import { savePendingDeletionIntent, hasPendingDeletion } from '../pendingDeletion';
beforeEach(async () => { await AsyncStorage.clear(); });
test('ownerless legacy consent cannot authorize a later private subject', async () => {
  await saveLocalConsent(true);
  expect(await loadLocalConsent('owner')).toBeNull();
});
test('a late consent reply cannot restore opt-in after durable deletion intent', async () => {
  await AsyncStorage.setItem('neptranslate.private_identity.v1', 'owner');
  await saveLocalConsent(true, 'owner');
  await savePendingDeletionIntent('owner');
  await clearLocalConsent('owner');
  expect(await saveLocalConsent(true, 'owner')).toBeNull();
  expect(await loadLocalConsent('owner')).toBeNull();
  expect(await hasPendingDeletion('owner')).toBe(true);
});
test('owner replacement rejects late consent without adopting it into the new identity', async () => {
  await AsyncStorage.setItem('neptranslate.private_identity.v1', 'new-owner');
  expect(await saveLocalConsent(true, 'old-owner')).toBeNull();
  expect(await loadLocalConsent('new-owner')).toBeNull();
});
test('an operation invalidated during storage write removes the late opt-in', async () => {
  await AsyncStorage.setItem('neptranslate.private_identity.v1', 'owner');
  const write = AsyncStorage.setItem as jest.Mock;
  const original = write.getMockImplementation()!;
  let current = true;
  write.mockImplementation(async (key: string, value: string) => {
    await original(key, value);
    if (key === 'neptranslate.contribution_consent.v1') current = false;
  });
  try {
    expect(await saveLocalConsent(true, 'owner', () => current)).toBeNull();
    expect(await loadLocalConsent('owner')).toBeNull();
  } finally { write.mockImplementation(original); }
});
test('pending deletion storage errors deny authorization', async () => {
  await saveLocalConsent(true, 'owner');
  await AsyncStorage.setItem('neptranslate.sharedDeletion.v2', '{broken');
  expect(await loadLocalConsent('owner')).toBeNull();
  expect(await hasPendingDeletion('owner')).toBe(true);
});

test('an owner change during the consent write removes that late revision', async () => {
  await AsyncStorage.setItem('neptranslate.private_identity.v1', 'owner-A');
  const write = AsyncStorage.setItem as jest.Mock;
  const original = write.getMockImplementation()!;
  write.mockImplementation(async (key: string, value: string) => {
    await original(key, value);
    if (key === 'neptranslate.contribution_consent.v1') await original('neptranslate.private_identity.v1', 'owner-B');
  });
  try {
    expect(await saveLocalConsent(true, 'owner-A')).toBeNull();
    expect(await loadLocalConsent('owner-B')).toBeNull();
  } finally { write.mockImplementation(original); }
});
test('malformed owner deletion records cannot turn a pending intent into permission', async () => {
  await saveLocalConsent(true, 'owner');
  await AsyncStorage.setItem('neptranslate.sharedDeletion.v2', JSON.stringify({ owner: { ownerId: 'another' } }));
  expect(await hasPendingDeletion('owner')).toBe(true);
  expect(await loadLocalConsent('owner')).toBeNull();
});
