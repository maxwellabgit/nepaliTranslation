import { test, expect } from '@playwright/test';
import { SCENARIO_CATALOG } from './catalog';
import { openHostedApp, typeAndSubmit, expectVisible } from './helpers/app';
import {
  ensureArtifactRun,
  finishArtifactRun,
  recordScenario,
  artifactDir,
} from './helpers/artifacts';

test.describe.configure({ mode: 'serial' });

test.beforeAll(() => {
  ensureArtifactRun();
});

test.afterAll(() => {
  const summary = finishArtifactRun('ok');
  if (summary?.dir) {
    // eslint-disable-next-line no-console
    console.log('[test:scenarios] artifacts →', summary.dir);
  }
});

test('catalog lists 12 scenarios', () => {
  expect(SCENARIO_CATALOG).toHaveLength(12);
  expect(SCENARIO_CATALOG.filter((s) => s.status === 'automated')).toHaveLength(10);
  expect(SCENARIO_CATALOG.filter((s) => s.status === 'blocked')).toHaveLength(2);
});

test('01 cold launch / empty Speak', async ({ page }) => {
  const id = '01-cold-launch-empty-speak';
  try {
    await openHostedApp(page);
    await expectVisible(page, 'pane-translate');
    await expectVisible(page, 'speak-hero');
    await expect(page.getByTestId('speak-hero')).toContainText('Speak');
    await expect(page.getByTestId('speak-hero')).toContainText('बोल्नुहोस्');
    await expectVisible(page, 'translate-input');
    recordScenario({ id, status: 'passed' });
  } catch (err) {
    recordScenario({
      id,
      status: 'failed',
      detail: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
});

test('02 typed EN→NE Hello→नमस्ते', async ({ page }) => {
  const id = '02-typed-en-ne-hello';
  try {
    await openHostedApp(page);
    await typeAndSubmit(page, 'Hello');
    await expect(page.getByTestId('translate-output')).toContainText('नमस्ते', {
      timeout: 30_000,
    });
    recordScenario({ id, status: 'passed' });
  } catch (err) {
    recordScenario({
      id,
      status: 'failed',
      detail: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
});

test('03 tab switch Translate / Camera / Learn', async ({ page }) => {
  const id = '03-tab-switch';
  try {
    await openHostedApp(page);
    await expectVisible(page, 'tab-translate');
    await page.getByTestId('tab-camera').click();
    await expectVisible(page, 'pane-camera');
    await expectVisible(page, 'camera-screen');
    await page.getByTestId('tab-learn').click();
    await expectVisible(page, 'pane-learn');
    await expectVisible(page, 'learn-screen');
    await page.getByTestId('tab-translate').click();
    await expectVisible(page, 'pane-translate');
    recordScenario({ id, status: 'passed' });
  } catch (err) {
    recordScenario({
      id,
      status: 'failed',
      detail: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
});

test('04 history overlay open / close', async ({ page }) => {
  const id = '04-history-overlay';
  try {
    await openHostedApp(page);
    await page.getByTestId('open-history').click();
    await expectVisible(page, 'overlay-history');
    await expectVisible(page, 'history-screen');
    await page.getByTestId('history-close').click();
    await expect(page.getByTestId('overlay-history')).toHaveCount(0);
    recordScenario({ id, status: 'passed' });
  } catch (err) {
    recordScenario({
      id,
      status: 'failed',
      detail: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
});

test('05 learn alphabet glyph visible', async ({ page }) => {
  const id = '05-learn-alphabet-glyph';
  try {
    await openHostedApp(page);
    await page.getByTestId('tab-learn').click();
    await expectVisible(page, 'learn-glyph-a');
    await expect(page.getByTestId('learn-roman-a')).toContainText('a');
    recordScenario({ id, status: 'passed' });
  } catch (err) {
    recordScenario({
      id,
      status: 'failed',
      detail: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
});

test('06 camera tab permission or live UI', async ({ page }) => {
  const id = '06-camera-permission';
  try {
    await openHostedApp(page, { ocrFixture: null });
    await page.getByTestId('tab-camera').click();
    await expectVisible(page, 'camera-screen');
    // Product Camera still uses expo-camera permissions (not TG cameraPermission).
    // On web this is permission UI and/or live shutter — not iOS ML Kit parity.
    const permission = page.getByTestId('camera-permission');
    const live = page.getByTestId('camera-live');
    await expect(permission.or(live)).toBeVisible({ timeout: 30_000 });
    recordScenario({
      id,
      status: 'passed',
      detail: 'expo-camera web permission/live — TG cameraPermission unused by UI',
    });
  } catch (err) {
    recordScenario({
      id,
      status: 'failed',
      detail: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
});

test('07 camera OCR fixture result (not native ML Kit)', async ({ page }) => {
  const id = '07-camera-ocr-fixture';
  try {
    await openHostedApp(page, { ocrFixture: 'inscription' });
    await page.getByTestId('tab-camera').click();
    await expectVisible(page, 'camera-result');
    await expectVisible(page, 'camera-overlay-s1');
    await expect(page.getByText('Hail to Lord Shiva.')).toBeVisible();
    recordScenario({
      id,
      status: 'passed',
      detail: 'TG inscription fixture only — not native OCR parity',
    });
  } catch (err) {
    recordScenario({
      id,
      status: 'failed',
      detail: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
});

test('08 pass-the-phone after typed turn', async ({ page }) => {
  const id = '08-pass-the-phone';
  try {
    await openHostedApp(page);
    await typeAndSubmit(page, 'Hello');
    await expect(page.getByTestId('translate-output')).toContainText('नमस्ते', {
      timeout: 30_000,
    });
    await expect(page.getByTestId('speak-dock')).toBeVisible();
    await expect(page.getByTestId('pass-phone')).toBeVisible();
    await page.getByTestId('pass-phone').click();
    await expect(page.getByTestId('pass-phone')).toContainText('पास');
    recordScenario({ id, status: 'passed' });
  } catch (err) {
    recordScenario({
      id,
      status: 'failed',
      detail: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
});

test('09 settings overlay open / close', async ({ page }) => {
  const id = '09-settings-overlay';
  try {
    await openHostedApp(page);
    await page.getByTestId('open-settings').click();
    await expectVisible(page, 'overlay-settings');
    await page.getByTestId('settings-close').click();
    await expect(page.getByTestId('overlay-settings')).toHaveCount(0);
    recordScenario({ id, status: 'passed' });
  } catch (err) {
    recordScenario({
      id,
      status: 'failed',
      detail: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
});

test('10 speech permission denied via TG bridge', async ({ page }) => {
  const id = '10-speech-permission-denied';
  try {
    await openHostedApp(page, { speechPermission: 'denied' });
    await page.getByTestId('speak-hero').click();
    await expectVisible(page, 'translate-status');
    await expect(page.getByTestId('translate-status')).toContainText(/permission/i);
    recordScenario({ id, status: 'passed' });
  } catch (err) {
    recordScenario({
      id,
      status: 'failed',
      detail: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
});

test('11 live mic STT — blocked on Windows', async () => {
  const id = '11-live-mic-stt';
  recordScenario({
    id,
    status: 'blocked',
    detail: 'Native mic/STT — see scenarios/blockers.md',
  });
  test.skip(true, 'Native microphone STT requires physical iPhone');
});

test('12 live camera capture OCR — blocked on Windows', async () => {
  const id = '12-live-camera-capture-ocr';
  recordScenario({
    id,
    status: 'blocked',
    detail: 'Native camera/ML Kit — see scenarios/blockers.md',
  });
  test.skip(true, 'Native camera OCR requires physical iPhone');
});

/** F2 layout smoke: primary chrome meets 44pt touch targets on iPad viewports. */
test('primary tab touch targets are at least 44px', async ({ page }, testInfo) => {
  test.skip(
    !testInfo.project.name.startsWith('ipad'),
    'iPad viewport projects only',
  );
  await openHostedApp(page);
  for (const id of ['tab-translate', 'tab-camera', 'tab-learn', 'speak-hero'] as const) {
    const box = await page.getByTestId(id).boundingBox();
    expect(box, id).toBeTruthy();
    expect(box!.height, `${id} height`).toBeGreaterThanOrEqual(44);
    expect(box!.width, `${id} width`).toBeGreaterThanOrEqual(44);
  }

  await typeAndSubmit(page, 'Hello');
  await expect(page.getByTestId('pass-phone')).toBeVisible({ timeout: 30_000 });
  const passBox = await page.getByTestId('pass-phone').boundingBox();
  expect(passBox, 'pass-phone').toBeTruthy();
  expect(passBox!.height, 'pass-phone height').toBeGreaterThanOrEqual(44);
  expect(passBox!.width, 'pass-phone width').toBeGreaterThanOrEqual(44);

  // Fixture result always exposes retake; live shutter needs camera grant (often absent on web).
  await openHostedApp(page, { ocrFixture: 'inscription' });
  await page.getByTestId('tab-camera').click();
  await expectVisible(page, 'camera-result');
  const retakeBox = await page.getByTestId('camera-retake').boundingBox();
  expect(retakeBox, 'camera-retake').toBeTruthy();
  expect(retakeBox!.height, 'camera-retake height').toBeGreaterThanOrEqual(44);
  expect(retakeBox!.width, 'camera-retake width').toBeGreaterThanOrEqual(44);

  await openHostedApp(page, { ocrFixture: null });
  await page.getByTestId('tab-camera').click();
  const shutter = page.getByTestId('camera-shutter');
  if (await shutter.isVisible().catch(() => false)) {
    const shutterBox = await shutter.boundingBox();
    expect(shutterBox, 'camera-shutter').toBeTruthy();
    expect(shutterBox!.height, 'camera-shutter height').toBeGreaterThanOrEqual(44);
    expect(shutterBox!.width, 'camera-shutter width').toBeGreaterThanOrEqual(44);
  } else {
    const allowBox = await page.getByTestId('camera-allow').boundingBox();
    expect(allowBox, 'camera-allow (shutter gated on permission)').toBeTruthy();
    expect(allowBox!.height, 'camera-allow height').toBeGreaterThanOrEqual(44);
  }
});

test('artifact writer produced events.jsonl', async () => {
  const dir = artifactDir();
  expect(dir).toBeTruthy();
  const { readFileSync, existsSync } = await import('node:fs');
  const { join } = await import('node:path');
  expect(existsSync(join(dir!, 'events.jsonl'))).toBe(true);
  expect(existsSync(join(dir!, 'summary.json'))).toBe(true);
  const events = readFileSync(join(dir!, 'events.jsonl'), 'utf8');
  expect(events).toContain('scenario.');
});
