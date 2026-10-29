// Every screen an Admin can reach opens without errors, and each one loads quickly
import { expect, test } from '@playwright/test';
import { storageFor, watchErrors } from './support/helpers';
import { readState } from './support/testData';

test.use({ storageState: storageFor('admin') });

const SCREENS: [string, string, RegExp][] = [
  ['Dashboard', '/', /All projects/],
  ['Archive', '/archive', /Archived Projects/],
  ['Team', '/team', /Team & Guest Management/],
  ['AI Credits', '/credits', /AI Credits/],
  ['Settings: details', '/settings', /Workspace Settings/],
  ['Settings: access', '/settings/access', /Workspace Settings/],
  ['Settings: notifications', '/settings/notifications', /Workspace Settings/],
  ['Settings: teams', '/settings/teams', /Workspace Settings/],
  ['QA scores', '/qa-score', /QA Score/],
];

for (const [name, path, heading] of SCREENS) {
  test(`${name} opens without errors`, async ({ page }) => {
    const watch = watchErrors(page);
    const started = Date.now();
    await page.goto(path);
    await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();
    const ms = Date.now() - started;
    test.info().annotations.push({ type: 'load time', description: `${ms} ms` });
    expect(ms, 'time until the screen shows').toBeLessThan(8000);
    watch.expectNone();
  });
}

test('the sidebar moves between screens', async ({ page }) => {
  const watch = watchErrors(page);
  await page.goto('/');
  for (const [button, url] of [['Archive', '/archive'], ['Team', '/team'], ['QA Score Matrix', '/qa-score'], ['AI Credits', '/credits'], ['Settings', '/settings'], ['Dashboard', '/']] as const) {
    await page.getByRole('button', { name: button, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${url.replace('/', '\\/')}$`));
  }
  watch.expectNone();
});

test('search finds the test folder and hides others', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder('Search folders and projects...').fill('E2E-TEST');
  await expect(page.getByRole('heading', { name: 'E2E-TEST', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'BRDL' })).toBeHidden();
});

for (const view of ['Canvas', 'Kanban', 'Table', 'Activity']) {
  test(`project ${view} view opens without errors`, async ({ page }) => {
    const watch = watchErrors(page);
    await page.goto(`/projects/${readState().projectId}`);
    await page.getByRole('button', { name: view, exact: true }).click();
    if (view === 'Canvas') await expect(page.locator('iframe').first()).toBeVisible();
    if (view === 'Kanban') await expect(page.getByPlaceholder('Filter tasks...')).toBeVisible();
    if (view === 'Table') await expect(page.getByRole('button', { name: 'Export CSV' })).toBeVisible();
    if (view === 'Activity') await expect(page.getByRole('button', { name: 'All Events' })).toBeVisible();
    watch.expectNone();
  });
}

test('canvas switches between desktop, tablet and mobile widths', async ({ page }) => {
  await page.goto(`/projects/${readState().projectId}`);
  const frame = page.locator('iframe').first();
  await expect(frame).toBeVisible();
  const widths: Record<string, number> = {};
  for (const device of ['Desktop', 'Tablet', 'Mobile']) {
    await page.locator(`button[title^="${device}"]`).click();
    await expect(page).toHaveURL(new RegExp(`view_mode=${device}`));
    await page.waitForTimeout(500);
    widths[device] = (await frame.boundingBox())!.width;
  }
  expect(widths.Tablet).toBeLessThan(widths.Desktop);
  expect(widths.Mobile).toBeLessThan(widths.Tablet);
});
