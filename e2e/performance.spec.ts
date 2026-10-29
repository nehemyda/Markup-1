// Speed as the browser measures it, and how the server holds up with many people opening Vpin at once.
// These run against the server under test; for real numbers from other countries the app must be hosted.
import { expect, test } from '@playwright/test';
import { dashboardReady, storageFor } from './support/helpers';

test('login page: first paint and full load', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign In to Workspace' }).waitFor();
  const t = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const paint = performance.getEntriesByName('first-contentful-paint')[0];
    const bytes = performance.getEntriesByType('resource').reduce((sum, r: any) => sum + (r.transferSize || r.encodedBodySize || 0), 0) + (nav.transferSize || 0);
    return { ttfb: nav.responseStart, fcp: paint?.startTime ?? null, load: nav.loadEventEnd, kb: Math.round(bytes / 1024) };
  });
  test.info().annotations.push({ type: 'login page', description: JSON.stringify(t) });
  expect(t.ttfb).toBeLessThan(800);
  expect(t.load).toBeLessThan(4000);
});

test.describe('signed in', () => {
  test.use({ storageState: storageFor('admin') });
  test('dashboard is usable within 5 seconds', async ({ page }) => {
    const started = Date.now();
    await page.goto('/');
    await dashboardReady(page);
    const ms = Date.now() - started;
    test.info().annotations.push({ type: 'dashboard ready', description: `${ms} ms` });
    expect(ms).toBeLessThan(5000);
  });
});

test('50 visitors opening the app at the same moment', async ({ request, browserName }) => {
  test.skip(browserName !== 'chromium', 'server load is the same whatever the browser; measured once');
  const time = async (path: string) => {
    const started = Date.now();
    const res = await request.get(path);
    return { ok: res.ok(), ms: Date.now() - started };
  };
  const runs = await Promise.all(Array.from({ length: 50 }, (_, i) => time(i % 2 ? '/' : '/api/health')));
  const ms = runs.map((r) => r.ms).sort((a, b) => a - b);
  const p95 = ms[Math.floor(ms.length * 0.95) - 1];
  test.info().annotations.push({ type: '50 at once', description: `median ${ms[25]} ms, p95 ${p95} ms, slowest ${ms.at(-1)} ms, failed ${runs.filter((r) => !r.ok).length}` });
  expect(runs.every((r) => r.ok)).toBeTruthy();
  expect(p95).toBeLessThan(2000);
});
