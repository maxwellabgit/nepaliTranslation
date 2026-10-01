import { expect, test } from '@playwright/test';
import { openHostedApp } from './helpers/app';

test.use({ viewport: { width: 390, height: 844 } });

test('mixed-language capture of the local sample photo', async ({ page }) => {
  test.setTimeout(240_000);
  const probe = await page.request.get('/fixtures/nepTextEx2.jpg');
  test.skip(!probe.ok(), 'local sample image is not in public/fixtures');

  await openHostedApp(page, {
    ocrFixture: null,
    captureSource: '/fixtures/nepTextEx2.jpg',
    translations: [],
    cameraPermission: 'granted',
  });
  const welcome = page.getByTestId('welcome-continue');
  await welcome.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => undefined);
  if (await welcome.isVisible().catch(() => false)) await welcome.click();
  const daily = page.getByTestId('daily-open-ad-close');
  await daily.waitFor({ state: 'visible', timeout: 8_000 }).catch(() => undefined);
  if (await daily.isVisible().catch(() => false)) await daily.click();
  await expect(page.getByTestId('welcome-card')).toHaveCount(0);
  await page.getByTestId('tab-camera').click();
  await expect(page.getByTestId('camera-screen')).toBeVisible();
  await expect(page.getByTestId('camera-result')).toBeVisible({ timeout: 150_000 });
  await expect(page.getByTestId('camera-output')).toBeVisible();

  const report = await page.evaluate(() => {
    const metrics = (
      window as unknown as { __NEPTRANSLATE_CAPTURE_METRICS__?: unknown }
    ).__NEPTRANSLATE_CAPTURE_METRICS__;
    const lines = (
      window as unknown as { __NEPTRANSLATE_OCR_LINES__?: unknown }
    ).__NEPTRANSLATE_OCR_LINES__;
    const sections = [...document.querySelectorAll('[data-testid^="camera-section-"]')].map(
      (node) => ({
        text: (node.textContent ?? '').replace(/\s+/g, ' ').trim(),
        label: node.getAttribute('aria-label'),
      }),
    );
    return { metrics, lines, sections };
  });
  console.log(JSON.stringify(report, null, 2));

  await page.screenshot({
    path: 'output/mixed-capture/expanded-en.png',
    fullPage: false,
  });

  const ocrBeforeSwitch = await page.evaluate(
    () =>
      (window as unknown as { __NEPTRANSLATE_CAPTURE_METRICS__?: { ocr: number } })
        .__NEPTRANSLATE_CAPTURE_METRICS__?.ocr,
  );
  await page.getByTestId('camera-target').click();
  await page.getByTestId('camera-target-ne-deva').click();
  await expect(page.getByTestId('camera-target')).toContainText('Devanagari');
  await page.screenshot({ path: 'output/mixed-capture/target-deva.png' });
  await page.getByTestId('camera-target').click();
  await page.getByTestId('camera-target-ne-roman').click();
  await expect(page.getByTestId('camera-target')).toContainText('Romanized');
  await page.screenshot({ path: 'output/mixed-capture/target-roman.png' });
  await page.getByTestId('camera-target').click();
  await page.getByTestId('camera-target-en').click();
  const ocrAfterSwitch = await page.evaluate(
    () =>
      (window as unknown as { __NEPTRANSLATE_CAPTURE_METRICS__?: { ocr: number } })
        .__NEPTRANSLATE_CAPTURE_METRICS__?.ocr,
  );
  console.log(JSON.stringify({ ocrBeforeSwitch, ocrAfterSwitch }));
  expect(ocrAfterSwitch).toBe(ocrBeforeSwitch);
});
