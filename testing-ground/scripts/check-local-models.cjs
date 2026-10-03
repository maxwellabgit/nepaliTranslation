/* Live local-WASM smoke. Run after export:web, prepare:hosted and Vite start.
 * Uses no recorded translation, screenshot or recording. */
const { chromium, expect } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge' });
  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 380, height: 622 });
    await page.addInitScript(() => {
      window.__NEPTRANSLATE_TG__ = {
        harness: 'neptranslate-testing-ground', translateMode: 'local-neural',
        acknowledgeStartupConsent: 'auto-accept', offline: true,
      };
    });
    await page.goto('http://127.0.0.1:5173/hosted-app/index.html');
    const award = page.getByTestId('credit-award-collect');
    await expect(award).toBeVisible();
    await award.click();
    expect(await page.getByTestId('translate-send-motion').evaluate(el => getComputedStyle(el).opacity)).toBe('0');
    const input = page.locator('textarea');
    await input.fill('Hello, how are you?');
    await page.waitForTimeout(400);
    const sendBounds = await page.getByTestId('translate-send').boundingBox();
    const micBounds = await page.getByTestId('speak-hero').boundingBox();
    expect(sendBounds.x).toBeGreaterThanOrEqual(micBounds.x + micBounds.width - 1);
    expect(sendBounds.width).toBeGreaterThan(80);
    expect(await page.getByTestId('translate-send-motion').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(63, 126, 101)');
    console.log('Translate dock: PASS (green, fills right of microphone at 380px viewport).');
    await page.getByTestId('translate-send').click();
    const output = page.getByTestId('translate-output');
    await expect(output).toContainText(/[\u0900-\u097f]/, { timeout: 120000 });
    console.log('EN→NE local WASM:', await output.innerText());
    expect(await output.evaluate(el => getComputedStyle(el).fontWeight)).toBe('400');
    expect(await page.getByTestId('play-source').count()).toBe(0);
    expect(await page.getByTestId('source-script-line').count()).toBe(0);
    await page.getByTestId('mark-incorrect').click();
    await expect(page.getByTestId('correction-input')).toBeVisible();
    await page.getByTestId('correction-backdrop').click({ position: { x: 5, y: 5 } });
    await expect(page.getByTestId('correction-input')).toHaveCount(0);
    await expect(page.getByTestId('translate-send')).toBeEnabled();
    await page.getByRole('radio', { name: 'Nepali', exact: true }).click();
    await input.fill('नमस्ते');
    await page.getByTestId('translate-send').click();
    await expect(output).toContainText(/[A-Za-z]/, { timeout: 120000 });
    console.log('NE→EN local WASM:', await output.innerText());
    await expect(page.getByTestId('formality-switch')).toHaveCount(0);
    const timerBox = await page.getByTestId('credits-gauge').boundingBox();
    for (const tab of ['tab-camera', 'tab-learn', 'tab-translate']) {
      await page.getByTestId(tab).click();
      const box = await page.getByTestId('credits-gauge').boundingBox();
      expect(box.x).toBeCloseTo(timerBox.x, 0);
      expect(box.y).toBeCloseTo(timerBox.y, 0);
    }
    await page.getByTestId('open-history').click();
    await page.getByRole('button', { name: 'Clear history', exact: true }).click();
    await expect(page.getByTestId('history-clear-dialog')).toBeVisible();
    await page.getByTestId('history-clear-confirm').click();
    await expect(page.getByTestId('history-empty')).toBeVisible();
    console.log('Shared UI: PASS (normal output, output-only speaker, outside editor dismissal, fixed timer position, real History Clear).');
    await page.goto('http://127.0.0.1:5173');
    await page.evaluate(() => {
      localStorage.setItem('nepx.entitlement.v1', JSON.stringify({
        earnedAdFreeUntilMs: Date.now() + 36000000, lifetimeCredits: 60,
        version: 1, syncedAtMs: Date.now(),
      }));
      localStorage.setItem('@neptranslate/ads/foregroundActiveMs', '600000');
    });
    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    const frame = page.frameLocator('iframe');
    await expect(frame.getByTestId('credits-gauge-timer')).toHaveText('0:00', { timeout: 30000 });
    await expect(frame.getByTestId('credit-award-overlay')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('nepx.entitlement.v1'))).toBeNull();
    expect(await page.evaluate(() => Number(localStorage.getItem('@neptranslate/ads/foregroundActiveMs') ?? 0))).toBeLessThan(5000);
    console.log('Testing-ground reset: PASS (0:00, no welcome award, earned/foreground counters cleared).');
    const earnedUntil = Date.now() + 20 * 60_000;
    await page.evaluate(until => {
      const state = JSON.parse(localStorage.getItem('neptranslate.dailyOpen.v2'));
      localStorage.setItem('neptranslate.dailyOpen.v2', JSON.stringify({ ...state, untilMs: until }));
    }, earnedUntil);
    await page.locator('input[type="checkbox"]').uncheck();
    await expect(frame.getByTestId('credits-gauge-timer')).not.toHaveText('0:00');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('neptranslate.dailyOpen.v2')).untilMs)).toBe(earnedUntil);
    console.log('One-shot Reset: PASS (ordinary remount preserves time earned afterward).');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
