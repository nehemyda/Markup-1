import { Page, expect } from '@playwright/test';
import { readState } from './testData';

export const storageFor = (who: 'admin' | 'member') => `e2e/.state/${who}.json`;

// Signs in through the login page with "name" + the email domain picker
export async function signIn(page: Page, emailName: string, password = readState().password) {
  await page.goto('/');
  await page.getByPlaceholder('your.name').fill(emailName);
  await page.locator('input[type=password]').fill(password);
  await page.getByRole('button', { name: 'Sign In to Workspace' }).click();
}

// Collects console errors and failed requests while a test runs. Google's favicon service answers 404 for
// sites it has no icon for; that is noise, not an app error, and is reported separately.
export function watchErrors(page: Page) {
  const errors: string[] = [];
  const ignore = (text: string) => /gstatic\.com\/faviconV2|Failed to load resource: the server responded with a status of 404/.test(text);
  page.on('console', (m) => {
    // The app reports failed saves as warnings ("Failed saving project: ...")
    const failedWarning = m.type() === 'warning' && /fail/i.test(m.text());
    if ((m.type() === 'error' || failedWarning) && !ignore(m.text())) errors.push(`console ${m.type()}: ${m.text().slice(0, 300)}`);
  });
  page.on('pageerror', (e) => errors.push(`page error: ${e.message}`));
  page.on('response', (r) => {
    if (r.status() >= 500 || (r.status() >= 400 && new URL(r.url()).origin === new URL(page.url() || 'http://x').origin && !ignore(r.url()))) {
      errors.push(`${r.status()} ${r.request().method()} ${r.url()}`);
    }
  });
  return {
    errors,
    expectNone: () => expect(errors, 'console errors or failed requests').toEqual([]),
  };
}

export async function dashboardReady(page: Page) {
  await expect(page.getByRole('heading', { name: /All projects/ })).toBeVisible();
}
