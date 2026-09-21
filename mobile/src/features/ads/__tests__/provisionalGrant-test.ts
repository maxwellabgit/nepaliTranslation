import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  acceptProvisionalGrant,
  createProvisionalGrant,
  loadProvisionalGrant,
  provisionalEarnedUntilMs,
  reconcileProvisional,
  saveProvisionalGrant,
  supportMessageForExpiredProvisional,
} from '../provisionalGrant';
import { PROVISIONAL_AD_FREE_MS, PROVISIONAL_EXPIRE_MS } from '../adConfig';

describe('provisionalGrant', () => {
  const t0 = 1_000_000;

  it('creates a 10-minute local window and 15-minute expiry', () => {
    const g = createProvisionalGrant('sess1', t0);
    expect(g.untilMs).toBe(t0 + PROVISIONAL_AD_FREE_MS);
    expect(g.expireAtMs).toBe(t0 + PROVISIONAL_EXPIRE_MS);
    expect(g.verified).toBe(false);
  });

  it('permits only one unresolved provisional', () => {
    const current = createProvisionalGrant('sess1', t0);
    const next = createProvisionalGrant('sess2', t0 + 1000);
    const rejected = acceptProvisionalGrant(current, next, t0 + 1000);
    expect(rejected.ok).toBe(false);
  });

  it('client callback alone is not a permanent ledger grant', () => {
    const g = createProvisionalGrant('sess1', t0);
    expect(g.verified).toBe(false);
    expect(provisionalEarnedUntilMs(g, t0 + 60_000)).toBe(g.untilMs);
  });

  it('reconciles once with verified SSV', () => {
    const g = createProvisionalGrant('sess1', t0);
    const verified = reconcileProvisional(g, t0 + 1000, {
      verifiedSessionToken: 'sess1',
    });
    expect(verified?.verified).toBe(true);
  });

  it('removes unverified remainder after 15 minutes', () => {
    const g = createProvisionalGrant('sess1', t0);
    const gone = reconcileProvisional(g, t0 + PROVISIONAL_EXPIRE_MS + 1);
    expect(gone).toBeNull();
    expect(provisionalEarnedUntilMs(g, t0 + PROVISIONAL_EXPIRE_MS + 1)).toBeNull();
  });

  it('accepts provisional after prior grant expired', () => {
    const expired = createProvisionalGrant('sess1', t0 - PROVISIONAL_EXPIRE_MS - 1);
    const next = createProvisionalGrant('sess2', t0);
    const accepted = acceptProvisionalGrant(expired, next, t0);
    expect(accepted.ok).toBe(true);
  });

  it('persists and loads provisional grant from AsyncStorage', async () => {
    await AsyncStorage.clear();
    const g = createProvisionalGrant('sess-persist', t0);
    await saveProvisionalGrant(g);
    expect(await loadProvisionalGrant()).toEqual(g);
    await saveProvisionalGrant(null);
    expect(await loadProvisionalGrant()).toBeNull();
  });

  it('returns null for invalid stored grant', async () => {
    await AsyncStorage.setItem(
      'neptranslate.ads.provisional_grant.v1',
      '{"bad":true}',
    );
    expect(await loadProvisionalGrant()).toBeNull();
  });

  it('support message mentions verification failure', () => {
    expect(supportMessageForExpiredProvisional()).toMatch(/verified/i);
  });
});
