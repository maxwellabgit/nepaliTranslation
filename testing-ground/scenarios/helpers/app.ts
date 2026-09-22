import { type Page, expect } from '@playwright/test';
import type { TestingGroundBootConfig } from '../../src/bridge/types';
import { scenarioBoot } from '../fixtures/boot';

const HOSTED = '/hosted-app/index.html';

/**
 * Inject TG boot before any app script runs, then open the Expo web export.
 *
 * When the boot fixture requests `acknowledgeStartupConsent: 'require'`,
 * the app renders the G2 startup consent gate instead of `app-shell`.
 * The helper waits for whichever surface applies so the scenario can
 * then walk the gate or the product surfaces.
 */
export async function openHostedApp(
  page: Page,
  overrides: Partial<TestingGroundBootConfig> = {},
): Promise<TestingGroundBootConfig> {
  const boot = scenarioBoot(overrides);
  await page.addInitScript((cfg) => {
    (window as unknown as { __NEPTRANSLATE_TG__?: unknown }).__NEPTRANSLATE_TG__ =
      cfg;
  }, boot);
  await page.goto(HOSTED, { waitUntil: 'domcontentloaded' });
  const expectStartupGate = boot.acknowledgeStartupConsent === 'require';
  const target = expectStartupGate
    ? page.getByTestId('startup-consent-gate')
    : page.getByTestId('app-shell');
  await expect(target).toBeVisible({ timeout: 60_000 });
  return boot;
}

export async function expectVisible(page: Page, testId: string) {
  await expect(page.getByTestId(testId)).toBeVisible({ timeout: 30_000 });
}

export async function typeAndSubmit(page: Page, text: string) {
  const input = page.getByTestId('translate-input');
  await expect(input).toBeVisible();
  await input.fill(text);
  await input.press('Enter');
}
