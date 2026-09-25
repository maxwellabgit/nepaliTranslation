import { test, expect } from '@playwright/test';
import { F9_SCENARIO_CATALOG } from './f9-catalog';
import { openHostedApp, expectVisible, typeAndSubmit } from './helpers/app';

test.describe.configure({ mode: 'serial' });

test('F9 catalog lists extended surfaces', () => {
  expect(F9_SCENARIO_CATALOG.length).toBeGreaterThanOrEqual(9);
  expect(F9_SCENARIO_CATALOG.every((s) => s.status === 'automated')).toBe(true);
});

test('f9-01 UI language toggle EN → नेपाली', async ({ page }) => {
  await openHostedApp(page);
  await page.getByTestId('open-settings').click();
  await expectVisible(page, 'settings-screen');
  await expect(page.getByTestId('settings-screen')).toContainText('Settings');
  await page.getByTestId('settings-lang-ne').click();
  await expect(page.getByTestId('settings-screen')).toContainText('सेटिङ', {
    timeout: 15_000,
  });
  await page.getByTestId('settings-lang-en').click();
  await expect(page.getByTestId('settings-screen')).toContainText('Settings');
  await page.getByTestId('settings-close').click();
});

test('f9-02 consent age confirm + save gated without sign-in', async ({ page }) => {
  await openHostedApp(page);
  await page.getByTestId('open-settings').click();
  await expectVisible(page, 'account-section');
  await expectVisible(page, 'age-confirm');
  await expectVisible(page, 'save-consent');
  await expect(page.getByTestId('account-section')).toContainText(/18/);
  await expect(page.getByTestId('account-section')).toContainText(/30 days/i);
  const save = page.getByTestId('save-consent');
  await expect(save).toBeDisabled();
  await page.getByTestId('age-confirm').click();
  // Still disabled without Sign in with Apple session.
  await expect(save).toBeDisabled();
  await page.getByTestId('settings-close').click();
});

test('f9-03 rewards surface on Learn', async ({ page }) => {
  await openHostedApp(page);
  await page.getByTestId('tab-learn').click();
  await expectVisible(page, 'learn-screen');
  await expectVisible(page, 'learn-earn-rewards');
  await expectVisible(page, 'reward-summary');
  await expect(page.getByTestId('learn-earn-rewards')).toBeVisible();
});

test('f9-04 ads flag-off → no house/banner on Learn', async ({ page }) => {
  await openHostedApp(page, {
    offline: true,
    featureFlags: { networkAdsEnabled: false },
  });
  await page.getByTestId('tab-learn').click();
  await expectVisible(page, 'learn-screen');
  await expect(page.getByTestId('ad-slot-house-learn_landing')).toHaveCount(0);
  await expect(page.getByTestId('ad-slot-banner-learn_landing')).toHaveCount(0);
});

test('f9-05 ads house when flag on + offline', async ({ page }) => {
  await openHostedApp(page, {
    offline: true,
    featureFlags: { networkAdsEnabled: true },
    canRequestAds: true,
  });
  // Learn landing is the reliable house placement on web (idle Translate may
  // stay unmounted/inactive while another tab is selected).
  await page.getByTestId('tab-learn').click();
  await expectVisible(page, 'ad-slot-house-learn_landing');
  await expectVisible(page, 'house-ad-not-now');
  await expectVisible(page, 'house-ad-prefer-no-ads');
});

test('f9-06 paywall requires sign-in — guest tap leaves core usable', async ({
  page,
}) => {
  // G3 / audit frozen contract: sign-in is required before purchase or
  // restore, so a guest cannot open the paywall from Settings. The
  // subscription row is still visible so the user knows an ad-free option
  // exists; tapping it while unauthenticated must not crash and must not
  // block core translation. Live SDK soft-fail after successful sign-in is
  // covered by R5 sandbox device proof, not by this Windows harness.
  await openHostedApp(page, {
    featureFlags: { paywallEnabled: true },
    iapSoftFail: true,
  });
  await page.getByTestId('open-settings').click();
  await expectVisible(page, 'settings-subscription');
  await page.getByTestId('settings-open-paywall').click();
  // Guest tap resolves without opening the sheet or throwing.
  await expect(page.getByTestId('paywall-sheet')).toHaveCount(0);
  await page.getByTestId('settings-close').click();
  await typeAndSubmit(page, 'Hello');
  await expect(page.getByTestId('translate-output')).toContainText('नमस्ते', {
    timeout: 30_000,
  });
});

test('f9-07 deletion messaging in consent copy', async ({ page }) => {
  await openHostedApp(page);
  await page.getByTestId('open-settings').click();
  await expectVisible(page, 'account-section');
  await expect(page.getByTestId('account-section')).toContainText(
    /within 30 days/i,
  );
  await expect(page.getByTestId('account-section')).toContainText(
    /Apple subscription/i,
  );
  await expectVisible(page, 'settings-deletion-info');
  await page.getByTestId('settings-close').click();
});

test('f9-08 dark mode via color scheme', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await openHostedApp(page);
  await expect(page.getByTestId('app-shell')).toHaveAttribute(
    'aria-label',
    /app-shell-dark/,
  );
  const bg = await page.getByTestId('app-shell').evaluate((el) => {
    return window.getComputedStyle(el).backgroundColor;
  });
  // darkColors.bg #1A1410 → rgb(26, 20, 16)
  expect(bg).toMatch(/rgb\(\s*26,\s*20,\s*16\s*\)/);
});

test('f9-startup-consent-gate accepts Terms and Privacy on first launch', async ({
  page,
}) => {
  // Explicit counterpart to the `acknowledgeStartupConsent: 'auto-accept'`
  // shortcut used by scenarioBoot. This scenario opts out of the bypass so
  // the audit rule holds: any test that reaches product surfaces without
  // acknowledging the gate must do so through a visible fixture. Here the
  // fixture value `'require'` makes the non-bypass explicit and this test
  // walks through the gate exactly as a real first-launch user would.
  await openHostedApp(page, { acknowledgeStartupConsent: 'require' });
  await expectVisible(page, 'startup-consent-gate');
  const continueBtn = page.getByTestId('startup-consent-continue');
  await expect(continueBtn).toBeDisabled();
  await page.getByTestId('startup-consent-terms').click();
  await expect(continueBtn).toBeDisabled();
  await page.getByTestId('startup-consent-privacy').click();
  await expect(page.getByTestId('startup-consent-age')).toHaveCount(0);
  await expect(continueBtn).toBeEnabled();
  await continueBtn.click();
  // After acknowledgement, the product surface renders.
  await expectVisible(page, 'tab-translate');
  await expect(page.getByTestId('startup-consent-gate')).toHaveCount(0);
});

test('f9-09 iPad viewport primary chrome', async ({ page }, testInfo) => {
  test.skip(
    !testInfo.project.name.startsWith('ipad'),
    'iPad viewport projects only',
  );
  await openHostedApp(page);
  await expectVisible(page, 'app-shell');
  await expectVisible(page, 'tab-translate');
  await expectVisible(page, 'tab-camera');
  await expectVisible(page, 'tab-learn');
  await expectVisible(page, 'speak-hero');
  await page.getByTestId('open-settings').click();
  await expectVisible(page, 'settings-lang-en');
  await page.getByTestId('settings-close').click();
  await page.getByTestId('tab-learn').click();
  await expectVisible(page, 'reward-summary');
});
