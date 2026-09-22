import {
  createProductionPurchaseService,
  createFakePurchaseService,
} from '../PurchaseService';
import {
  AD_FREE_ENTITLEMENT_ID,
  AD_FREE_PRODUCT_ID,
  EMPTY_SUBSCRIPTION,
} from '../purchaseTypes';
import {
  clearCachedSubscription,
  loadCachedSubscription,
} from '../subscriptionCache';

const mockConfigure = jest.fn(async () => undefined);
const mockGetOfferings = jest.fn();
const mockPurchasePackage = jest.fn();
const mockRestorePurchases = jest.fn();
const mockLogIn = jest.fn(async () => undefined);

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: (...args: unknown[]) => mockConfigure(...args),
    getOfferings: (...args: unknown[]) => mockGetOfferings(...args),
    purchasePackage: (...args: unknown[]) => mockPurchasePackage(...args),
    restorePurchases: (...args: unknown[]) => mockRestorePurchases(...args),
    logIn: (...args: unknown[]) => mockLogIn(...args),
  },
}));

jest.mock('../../../config/env', () => ({
  readPublicEnv: () => ({
    supabaseUrl: '',
    supabaseAnonKey: '',
    authConfigured: false,
    revenueCatAppleApiKey: 'appl_test_public_key',
  }),
}));

jest.mock('../../../services/supabase', () => ({
  getSupabase: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              status: 'active',
              product_id: 'neptranslate_adfree_monthly',
              expires_at: '2099-01-01T00:00:00.000Z',
            },
            error: null,
          }),
        }),
      }),
    }),
  }),
}));

describe('production PurchaseService with mocked SDK', () => {
  beforeEach(async () => {
    await clearCachedSubscription();
    mockConfigure.mockClear();
    mockGetOfferings.mockReset();
    mockPurchasePackage.mockReset();
    mockRestorePurchases.mockReset();
    mockLogIn.mockClear();
    mockGetOfferings.mockResolvedValue({
      current: {
        availablePackages: [
          {
            product: {
              identifier: AD_FREE_PRODUCT_ID,
              priceString: '$0.99',
            },
          },
        ],
      },
    });
    mockPurchasePackage.mockResolvedValue({
      customerInfo: {
        entitlements: {
          active: {
            [AD_FREE_ENTITLEMENT_ID]: {
              expirationDate: '2099-01-01T00:00:00.000Z',
            },
          },
        },
      },
    });
    mockRestorePurchases.mockResolvedValue({
      entitlements: {
        active: {
          [AD_FREE_ENTITLEMENT_ID]: {
            expirationDate: '2099-01-01T00:00:00.000Z',
          },
        },
      },
    });
  });

  it('configures, prices, purchases, and restores via native SDK', async () => {
    const svc = createProductionPurchaseService();
    await svc.configure();
    expect(mockConfigure).toHaveBeenCalledWith({
      apiKey: 'appl_test_public_key',
    });

    const price = await svc.getOfferPriceString();
    expect(price).toBe('$0.99');

    const bought = await svc.purchase();
    expect(bought.ok).toBe(true);
    if (bought.ok) {
      expect(bought.snapshot.status).toBe('active');
      expect(bought.snapshot.priceString).toBe('$0.99');
    }
    expect(svc.hasSubscription()).toBe(true);

    const restored = await svc.restore();
    expect(restored.ok).toBe(true);

    await svc.manage();
  });

  it('refresh merges server row and logs in app user', async () => {
    const svc = createProductionPurchaseService();
    await svc.configure();
    const snap = await svc.refresh('11111111-1111-4111-8111-111111111111');
    expect(snap.status).toBe('active');
    expect(mockLogIn).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
    );
    const cached = await loadCachedSubscription();
    expect(cached?.status).toBe('active');
  });

  it('soft-fails purchase when offering missing', async () => {
    mockGetOfferings.mockResolvedValue({ current: { availablePackages: [] } });
    const svc = createProductionPurchaseService();
    await svc.configure();
    const result = await svc.purchase();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('no_offering');
  });

  it('reports nothing_to_restore when entitlement inactive', async () => {
    mockRestorePurchases.mockResolvedValue({
      entitlements: { active: {} },
    });
    const svc = createProductionPurchaseService();
    await svc.configure();
    const result = await svc.restore();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('nothing_to_restore');
  });
});

describe('fake restore empty', () => {
  it('returns nothing_to_restore when never purchased', async () => {
    const svc = createFakePurchaseService({
      initial: { ...EMPTY_SUBSCRIPTION },
    });
    const result = await svc.restore();
    expect(result.ok).toBe(false);
  });
});
