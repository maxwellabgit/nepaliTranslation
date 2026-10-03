import { test, expect } from '@playwright/test';
import { F9_SCENARIO_CATALOG } from './f9-catalog';
import { openHostedApp, expectVisible, typeAndSubmit } from './helpers/app';

test.describe.configure({ mode: 'serial' });
test.use({ screenshot: 'off', video: 'off', trace: 'off' });

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
  await page.getByTestId('settings-lang-ne-roman').click();
  await expect(page.getByTestId('settings-screen')).toContainText('setinga');
  await expect.poll(() => page.evaluate(() =>
    JSON.parse(localStorage.getItem('neptranslate.prefs.v1') ?? '{}').uiLang,
  )).toBe('ne-roman');
  await page.getByTestId('settings-lang-en').click();
  await expect(page.getByTestId('settings-screen')).toContainText('Settings');
  await page.getByTestId('settings-close').click();
});

test('f9-02 optional sharing requires explicit consent, age and private connection', async ({ page }) => {
  await openHostedApp(page);
  await page.getByTestId('open-settings').click();
  await expectVisible(page, 'privacy-data-section');
  await expect(page.getByTestId('settings-screen')).not.toContainText(/\b(account|sign in|sign out|log in|login|register)\b/i);
  await expect(page.getByTestId('model-improvement-opt-in')).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByTestId('share-speech')).toBeDisabled();
  await expectVisible(page, 'age-confirm');
  await expectVisible(page, 'save-consent');
  await expect(page.getByTestId('privacy-data-section')).toContainText(/18/);
  await expect(page.getByTestId('privacy-data-section')).toContainText(/30 days/i);
  const save = page.getByTestId('save-consent');
  await expect(save).toBeDisabled();
  await page.getByTestId('age-confirm').click();
  await page.getByTestId('model-improvement-opt-in').click();
  await expect(page.getByTestId('sign-in-apple')).toHaveCount(0);
  // The recorded fixture has no live private data connection.
  await expect(save).toBeDisabled();
  await page.getByTestId('settings-close').click();
});

test("f9-03 Today's 10 contribution entry on Learn", async ({ page }) => {
  await openHostedApp(page);
  await page.getByTestId('tab-learn').click();
  await expectVisible(page, 'learn-screen');
  await expectVisible(page, 'learn-todays-10');
  await page.getByTestId('learn-todays-10').click();
  await expectVisible(page, 'review-screen');
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

test('f9-06 unavailable purchase service leaves core usable', async ({
  page,
}) => {
  // This web fixture has no live StoreKit/private service connection.
  await openHostedApp(page, {
    featureFlags: { paywallEnabled: true },
    iapSoftFail: true,
  });
  await page.getByTestId('open-settings').click();
  await expectVisible(page, 'settings-subscription');
  await page.getByTestId('settings-open-paywall').click();
  // Pricing is viewable without account UI; a failed private connection
  // blocks purchase and leaves the sheet dismissible and core usable.
  await expectVisible(page, 'paywall-sheet');
  await expect(page.getByTestId('paywall-sheet')).not.toContainText(/\b(account|sign in|login)\b/i);
  await page.getByTestId('paywall-subscribe').click();
  await expectVisible(page, 'paywall-message');
  await page.getByTestId('paywall-close').click();
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
  await expectVisible(page, 'privacy-data-section');
  await expect(page.getByTestId('privacy-data-section')).toContainText(
    /within 30 days/i,
  );
  await expect(page.getByTestId('privacy-data-section')).toContainText(
    /reinstalling|new phone/i,
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
  expect(await page.evaluate(() => localStorage.getItem('neptranslate.contribution_consent.v1'))).toBeNull();
  await page.getByTestId('credit-award-collect').click();
  await page.getByTestId('open-settings').click();
  await expect(page.getByTestId('model-improvement-opt-in')).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByTestId('save-consent')).toBeDisabled();
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
  await expectVisible(page, 'learn-todays-10');
});
