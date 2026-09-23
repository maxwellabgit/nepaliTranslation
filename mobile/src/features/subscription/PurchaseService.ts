import { Linking, Platform } from 'react-native';
import { readPublicEnv } from '../../config/env';
import { getSupabase } from '../../services/supabase';
import {
  AD_FREE_ENTITLEMENT_ID,
  AD_FREE_PRODUCT_ID,
  EMPTY_SUBSCRIPTION,
  hasActiveSubscription,
  type PurchaseResult,
  type SubscriptionSnapshot,
} from './purchaseTypes';
import {
  clearCachedSubscription,
  loadCachedSubscription,
  saveCachedSubscription,
  snapshotFromServerRow,
} from './subscriptionCache';

export type PurchaseService = {
  /** Soft-configure SDK when public key present. Never throws into translate. */
  configure: () => Promise<void>;
  getSnapshot: () => SubscriptionSnapshot;
  hasSubscription: () => boolean;
  refresh: (userId?: string | null) => Promise<SubscriptionSnapshot>;
  getOfferPriceString: () => Promise<string | null>;
  /**
   * G3: bind RevenueCat identity to a Supabase UUID before purchase/restore.
   * Anonymous RevenueCat identities can create webhook mismatches, so V1
   * requires sign-in before either flow.
   */
  identify: (userId: string) => Promise<void>;
  purchase: () => Promise<PurchaseResult>;
  restore: () => Promise<PurchaseResult>;
  manage: () => Promise<void>;
};

type NativeCustomerInfo = {
  entitlements?: {
    active?: Record<string, { expirationDate?: string | null }>;
  };
};

type NativePurchases = {
  configure: (opts: { apiKey: string; appUserID?: string }) => Promise<void>;
  getOfferings: () => Promise<{
    current?: {
      availablePackages?: Array<{
        product?: { identifier?: string; priceString?: string };
      }>;
    } | null;
  }>;
  purchasePackage: (pkg: unknown) => Promise<{
    customerInfo?: NativeCustomerInfo;
  }>;
  restorePurchases: () => Promise<NativeCustomerInfo>;
  getCustomerInfo?: () => Promise<NativeCustomerInfo>;
  logIn?: (appUserID: string) => Promise<{ customerInfo?: NativeCustomerInfo }>;
};

async function tryLoadPurchases(): Promise<NativePurchases | null> {
  try {
    // Dynamic require so Jest / Expo Go without native module soft-fail.
    const mod = require('react-native-purchases') as
      | NativePurchases
      | { default?: NativePurchases };
    if (mod && typeof (mod as NativePurchases).configure === 'function') {
      return mod as NativePurchases;
    }
    const nested = (mod as { default?: NativePurchases }).default;
    if (nested && typeof nested.configure === 'function') return nested;
    return null;
  } catch {
    return null;
  }
}

function snapshotFromCustomerInfo(
  info: {
    entitlements?: {
      active?: Record<string, { expirationDate?: string | null }>;
    };
  } | null | undefined,
  priceString: string | null,
): SubscriptionSnapshot {
  const active = info?.entitlements?.active?.[AD_FREE_ENTITLEMENT_ID];
  if (!active) {
    return {
      ...EMPTY_SUBSCRIPTION,
      priceString,
      updatedAtMs: Date.now(),
    };
  }
  const expiresAtMs = active.expirationDate
    ? Date.parse(active.expirationDate)
    : null;
  return {
    status: 'active',
    productId: AD_FREE_PRODUCT_ID,
    priceString,
    expiresAtMs: Number.isFinite(expiresAtMs) ? expiresAtMs : null,
    updatedAtMs: Date.now(),
  };
}

/** Deterministic fake for unit/integration tests. */
export function createFakePurchaseService(options?: {
  initial?: SubscriptionSnapshot;
  priceString?: string;
  /** When true, purchase/restore soft-fail as unavailable (no StoreKit/RC). */
  softFail?: boolean;
}): PurchaseService & {
  setSnapshot: (snap: SubscriptionSnapshot) => void;
} {
  let snap = options?.initial ?? { ...EMPTY_SUBSCRIPTION };
  let identified: string | null = null;
  const price = options?.priceString ?? '$2.99';
  return {
    setSnapshot: (next) => {
      snap = next;
    },
    configure: async () => undefined,
    identify: async (userId: string) => {
      identified = userId || null;
    },
    getSnapshot: () => snap,
    hasSubscription: () => hasActiveSubscription(snap, Date.now()),
    refresh: async (userId?: string | null) => {
      // Mirror production: refresh binds identity to the signed-in UUID so
      // subsequent purchase()/restore() flows can succeed.
      if (userId) identified = userId;
      return snap;
    },
    getOfferPriceString: async () => (options?.softFail ? null : price),
    purchase: async () => {
      if (!identified) return { ok: false, reason: 'sign_in_required' };
      if (options?.softFail) return { ok: false, reason: 'unavailable' };
      snap = {
        status: 'active',
        productId: AD_FREE_PRODUCT_ID,
        priceString: price,
        expiresAtMs: Date.now() + 30 * 24 * 60 * 60 * 1000,
        updatedAtMs: Date.now(),
      };
      await saveCachedSubscription(snap);
      return { ok: true, snapshot: snap };
    },
    restore: async () => {
      if (!identified) return { ok: false, reason: 'sign_in_required' };
      if (options?.softFail) return { ok: false, reason: 'unavailable' };
      if (snap.status === 'active') return { ok: true, snapshot: snap };
      return { ok: false, reason: 'nothing_to_restore' };
    },
    manage: async () => undefined,
  };
}

/**
 * Production PurchaseService. Soft-fails when RC key or native SDK missing.
 * Public Apple API key only — never embed webhook secrets.
 */
export function createProductionPurchaseService(): PurchaseService {
  let snap: SubscriptionSnapshot = { ...EMPTY_SUBSCRIPTION };
  let configured = false;
  let identifiedUserId: string | null = null;
  let cachedPrice: string | null = null;
  let lastPackage: unknown = null;

  return {
    async configure() {
      if (configured) return;
      const key = readPublicEnv().revenueCatAppleApiKey ?? '';
      if (!key) return;
      const native = await tryLoadPurchases();
      if (!native) return;
      try {
        // G3: do NOT configure with an anonymous app-user id. Wait for the
        // Supabase UUID via identify(). The paywall stays hidden until then.
        await native.configure({ apiKey: key });
        configured = true;
      } catch {
        configured = false;
      }
    },
    async identify(userId: string) {
      if (!userId) return;
      if (identifiedUserId === userId) return;
      const key = readPublicEnv().revenueCatAppleApiKey ?? '';
      if (!key) return;
      const native = await tryLoadPurchases();
      if (!native) return;
      try {
        if (!configured) {
          await native.configure({ apiKey: key, appUserID: userId });
          configured = true;
          identifiedUserId = userId;
        } else if (native.logIn) {
          const result = await native.logIn(userId);
          identifiedUserId = userId;
          const info = result?.customerInfo ?? null;
          if (info) {
            snap = snapshotFromCustomerInfo(info, cachedPrice);
            await saveCachedSubscription(snap);
          }
        }
      } catch {
        /* soft-fail; purchase/restore still reject on missing identity */
      }
    },
    getSnapshot: () => snap,
    hasSubscription: () => hasActiveSubscription(snap, Date.now()),
    async refresh(userId) {
      const local = await loadCachedSubscription();
      if (local) snap = local;

      if (userId) {
        await this.identify(userId);
        const sb = getSupabase();
        if (sb) {
          try {
            const { data } = await sb
              .from('purchased_subscriptions')
              .select('status, product_id, expires_at')
              .eq('user_id', userId)
              .maybeSingle();
            if (data) {
              const server = snapshotFromServerRow(data);
              snap = {
                ...server,
                priceString: snap.priceString ?? cachedPrice,
              };
              await saveCachedSubscription(snap);
            }
          } catch {
            /* soft-fail to cache */
          }
        }
        // Refresh CustomerInfo from RC on foreground/refresh (G3 audit).
        if (configured) {
          const native = await tryLoadPurchases();
          if (native?.getCustomerInfo) {
            try {
              const info = await native.getCustomerInfo();
              if (info) {
                const rcSnap = snapshotFromCustomerInfo(info, cachedPrice);
                if (rcSnap.status === 'active' || snap.status !== 'active') {
                  snap = rcSnap;
                  await saveCachedSubscription(snap);
                }
              }
            } catch {
              /* soft-fail */
            }
          }
        }
      }

      if (!userId && !local) {
        snap = { ...EMPTY_SUBSCRIPTION, priceString: cachedPrice };
      }
      return snap;
    },
    async getOfferPriceString() {
      if (cachedPrice) return cachedPrice;
      if (!configured) return null;
      const native = await tryLoadPurchases();
      if (!native) return null;
      try {
        const offerings = await native.getOfferings();
        const pkgs = offerings.current?.availablePackages ?? [];
        const match =
          pkgs.find((p) => p.product?.identifier === AD_FREE_PRODUCT_ID) ??
          pkgs[0];
        lastPackage = match ?? null;
        cachedPrice = match?.product?.priceString ?? null;
        return cachedPrice;
      } catch {
        return null;
      }
    },
    async purchase() {
      if (!identifiedUserId) return { ok: false, reason: 'sign_in_required' };
      if (!configured) return { ok: false, reason: 'unavailable' };
      const native = await tryLoadPurchases();
      if (!native) return { ok: false, reason: 'unavailable' };
      try {
        if (!lastPackage) await this.getOfferPriceString();
        if (!lastPackage) return { ok: false, reason: 'no_offering' };
        const result = await native.purchasePackage(lastPackage);
        snap = snapshotFromCustomerInfo(
          result.customerInfo ?? null,
          cachedPrice,
        );
        await saveCachedSubscription(snap);
        return { ok: true, snapshot: snap };
      } catch {
        return { ok: false, reason: 'purchase_failed' };
      }
    },
    async restore() {
      if (!identifiedUserId) return { ok: false, reason: 'sign_in_required' };
      if (!configured) return { ok: false, reason: 'unavailable' };
      const native = await tryLoadPurchases();
      if (!native) return { ok: false, reason: 'unavailable' };
      try {
        const info = await native.restorePurchases();
        snap = snapshotFromCustomerInfo(info, cachedPrice);
        await saveCachedSubscription(snap);
        if (!hasActiveSubscription(snap, Date.now())) {
          return { ok: false, reason: 'nothing_to_restore' };
        }
        return { ok: true, snapshot: snap };
      } catch {
        return { ok: false, reason: 'restore_failed' };
      }
    },
    async manage() {
      const url =
        Platform.OS === 'ios'
          ? 'https://apps.apple.com/account/subscriptions'
          : 'https://play.google.com/store/account/subscriptions';
      try {
        await Linking.openURL(url);
      } catch {
        /* soft-fail */
      }
    },
  };
}

export async function resetSubscriptionCacheForTests(): Promise<void> {
  await clearCachedSubscription();
}
