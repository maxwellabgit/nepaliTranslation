/** Ad-free monthly subscription product (App Store Connect / RevenueCat). */
export const AD_FREE_PRODUCT_ID = 'neptranslate_adfree_monthly';
export const AD_FREE_ENTITLEMENT_ID = 'ad_free';

export type SubscriptionStatus =
  | 'none'
  | 'active'
  | 'expired'
  | 'billing_retry'
  | 'cancelled';

export type SubscriptionSnapshot = {
  status: SubscriptionStatus;
  productId: string | null;
  /** StoreKit / RevenueCat localized price string when known. */
  priceString: string | null;
  expiresAtMs: number | null;
  updatedAtMs: number;
};

export type PurchaseResult =
  | { ok: true; snapshot: SubscriptionSnapshot }
  | { ok: false; reason: string };

export const EMPTY_SUBSCRIPTION: SubscriptionSnapshot = {
  status: 'none',
  productId: null,
  priceString: null,
  expiresAtMs: null,
  updatedAtMs: 0,
};

export function hasActiveSubscription(
  snap: SubscriptionSnapshot | null | undefined,
  nowMs: number,
): boolean {
  if (!snap) return false;
  // Cancelled still suppresses ads until the paid period ends (Apple grace).
  if (
    snap.status === 'active' ||
    snap.status === 'billing_retry' ||
    snap.status === 'cancelled'
  ) {
    if (snap.expiresAtMs != null && snap.expiresAtMs <= nowMs) return false;
    if (snap.status === 'cancelled' && snap.expiresAtMs == null) return false;
    return true;
  }
  return false;
}
