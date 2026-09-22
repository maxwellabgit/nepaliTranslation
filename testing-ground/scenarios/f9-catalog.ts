/**
 * F9 extended product surfaces (Windows Playwright / Expo web + TG adapters).
 * Not physical-device Maestro / StoreKit / AdMob parity.
 */
export const F9_SCENARIO_CATALOG = [
  {
    id: 'f9-01-ui-lang-toggle',
    title: 'UI language EN ↔ नेपाली via Settings',
    status: 'automated' as const,
  },
  {
    id: 'f9-02-consent-surface',
    title: 'Contribution consent age + save (gated without sign-in)',
    status: 'automated' as const,
  },
  {
    id: 'f9-03-rewards-surface',
    title: 'Learn earn-rewards / reward summary surface',
    status: 'automated' as const,
  },
  {
    id: 'f9-04-ads-flag-off',
    title: 'Ads adapters: network flag off → no house/banner',
    status: 'automated' as const,
  },
  {
    id: 'f9-05-ads-house-offline',
    title: 'Ads adapters: network flag on + offline → house',
    status: 'automated' as const,
  },
  {
    id: 'f9-06-iap-soft-fail',
    title: 'IAP/paywall adapter soft-fail (unavailable)',
    status: 'automated' as const,
  },
  {
    id: 'f9-07-deletion-messaging',
    title: 'Deletion / retention messaging (30-day + Apple billing)',
    status: 'automated' as const,
  },
  {
    id: 'f9-08-dark-mode',
    title: 'Dark mode via prefers-color-scheme',
    status: 'automated' as const,
  },
  {
    id: 'f9-09-ipad-chrome',
    title: 'iPad viewport: primary chrome visible',
    status: 'automated' as const,
  },
];
