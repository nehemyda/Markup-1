// End-to-end tests (e2e/). They sign in through the real login page against a running Vpin server and the
// Supabase project in .env, using throwaway "vpin-e2e-" accounts and "E2E TEST" projects that are removed afterwards.
//
//   E2E_BASE_URL=http://localhost:3100 npx playwright test      (default address: http://localhost:3100)
//   E2E_KEEP=1 ...                                              keep the test accounts and data for a look afterwards
//
// Run the server under test with BACKGROUND_JOBS=off and SMTP_HOST= (empty) so it sends no reminders or emails.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'e2e/results',
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 3,
  retries: 0,
  reporter: [['list'], ['html', { outputFolder: 'e2e/report', open: 'never' }], ['json', { outputFile: 'e2e/results/results.json' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3100',
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'sign-in', testMatch: /auth\.setup\.ts/, use: { ...devices['Desktop Chrome'] } },
    // Database rules and server limits: browser-independent, run once
    { name: 'api', testMatch: /api\.spec\.ts/, dependencies: ['sign-in'] },
    ...(['chromium', 'firefox', 'webkit'] as const).map((browser) => ({
      name: browser,
      testIgnore: [/api\.spec\.ts/, /auth\.setup\.ts/],
      dependencies: ['sign-in'],
      use: { ...devices[{ chromium: 'Desktop Chrome', firefox: 'Desktop Firefox', webkit: 'Desktop Safari' }[browser]], viewport: { width: 1440, height: 900 } },
    })),
  ],
});
