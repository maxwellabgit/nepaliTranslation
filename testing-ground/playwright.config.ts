import { defineConfig, devices } from '@playwright/test';

/**
 * Serves the Vite app (with /hosted-app from prepare:hosted) on port 5173.
 *
 * Prerequisites:
 *   cd mobile && npx expo export --platform web
 *   cd ../testing-ground && npm run prepare:hosted
 *
 * Or let webServer run prepare:hosted (requires mobile/dist already present).
 */
export default defineConfig({
  testDir: './scenarios',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  timeout: 90_000,
  expect: { timeout: 30_000 },
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
    viewport: { width: 1280, height: 900 },
  },
  webServer: {
    // Dev server serves public/hosted-app; preview only serves dist/ after build.
    command: 'npm run prepare:hosted && npx vite --host 127.0.0.1 --port 5173',
    url: 'http://127.0.0.1:5173/hosted-app/index.html',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
