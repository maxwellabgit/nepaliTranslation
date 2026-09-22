import {
  createFakePurchaseService,
  createProductionPurchaseService,
} from '../PurchaseService';
import {
  AD_FREE_PRODUCT_ID,
  hasActiveSubscription,
} from '../purchaseTypes';
import {
  clearCachedSubscription,
  loadCachedSubscription,
  saveCachedSubscription,
  snapshotFromServerRow,
} from '../subscriptionCache';

describe('purchaseTypes', () => {
  it('treats active and billing_retry as subscribed until expiry', () => {
    const now = 1_000;
    expect(
      hasActiveSubscription(
        {
          status: 'active',
          productId: AD_FREE_PRODUCT_ID,
          priceString: '$0.99',
          expiresAtMs: 2_000,
          updatedAtMs: now,
        },
        now,
      ),
    ).toBe(true);
    expect(
      hasActiveSubscription(
        {
          status: 'billing_retry',
          productId: AD_FREE_PRODUCT_ID,
          priceString: '$0.99',
          expiresAtMs: null,
          updatedAtMs: now,
        },
        now,
      ),
    ).toBe(true);
    expect(
      hasActiveSubscription(
        {
          status: 'expired',
          productId: AD_FREE_PRODUCT_ID,
          priceString: '$0.99',
          expiresAtMs: now - 1,
          updatedAtMs: now,
        },
        now,
      ),
    ).toBe(false);
  });
});

describe('fake PurchaseService', () => {
  beforeEach(async () => {
    await clearCachedSubscription();
  });

  it('purchases and restores deterministically', async () => {
    const svc = createFakePurchaseService({ priceString: '$0.99' });
    await svc.configure();
    expect(svc.hasSubscription()).toBe(false);
    const bought = await svc.purchase();
    expect(bought.ok).toBe(true);
    expect(svc.hasSubscription()).toBe(true);
    const restored = await svc.restore();
    expect(restored.ok).toBe(true);
  });

  it('caches subscription offline', async () => {
    const svc = createFakePurchaseService();
    await svc.purchase();
    const cached = await loadCachedSubscription();
    expect(cached?.status).toBe('active');
    await saveCachedSubscription({
      status: 'expired',
      productId: AD_FREE_PRODUCT_ID,
      priceString: '$0.99',
      expiresAtMs: Date.now() - 1,
      updatedAtMs: Date.now(),
    });
    expect((await loadCachedSubscription())?.status).toBe('expired');
  });
});

describe('snapshotFromServerRow', () => {
  it('maps server rows into cache snapshots', () => {
    expect(
      snapshotFromServerRow({
        status: 'active',
        product_id: AD_FREE_PRODUCT_ID,
        expires_at: '2026-12-01T00:00:00.000Z',
      }).status,
    ).toBe('active');
    expect(snapshotFromServerRow({ status: 'bogus' }).status).toBe('none');
  });
});

describe('production PurchaseService soft-fail', () => {
  it('configures without throwing when SDK/key missing', async () => {
    const svc = createProductionPurchaseService();
    await expect(svc.configure()).resolves.toBeUndefined();
    expect(svc.hasSubscription()).toBe(false);
    const purchase = await svc.purchase();
    expect(purchase.ok).toBe(false);
  });
});
