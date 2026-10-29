// What each role sees in the app: Members don't get Admin controls, guests only see the shared project
import { expect, test } from '@playwright/test';
import { storageFor, watchErrors } from './support/helpers';
import { PID, readState } from './support/testData';

test.describe('member', () => {
  test.use({ storageState: storageFor('member') });

  test('cannot delete a project someone else created', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('heading', { name: PID, exact: true }).click();
    await page.getByRole('button', { name: 'Project options' }).first().click();
    await expect(page.getByRole('button', { name: 'Open Studio & Annotate' })).toBeVisible();
    // Shown locked, with the reason
    await expect(page.getByRole('button', { name: /Delete (this )?project/i })).toHaveAttribute('title', 'Members can only delete projects they created');
  });

  test('cannot change roles or remove people on the Team page', async ({ page }) => {
    await page.goto('/team');
    await expect(page.getByRole('heading', { name: /Team & Guest Management/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Remove / })).toHaveCount(0);
    await expect(page.locator('select').filter({ hasText: 'Owner' })).toHaveCount(0);
  });

  test('does not see AI Credits', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'AI Credits', exact: true })).toBeHidden();
  });

  test('cannot add an allowed email domain', async ({ page }) => {
    await page.goto('/settings/access');
    await expect(page.getByRole('heading', { name: /Authorized Organization Email Domains/ })).toBeVisible();
    await expect(page.getByPlaceholder('e.g. broadly.com or yourcompany.com')).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Authorize Domain' })).toBeDisabled();
  });

  test('Branding settings are read-only', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: /Application Branding/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save Branding' })).toBeHidden();
  });
});

test.describe('guest with a review link', () => {
  test('opens the shared project without an account, and nothing else', async ({ page }) => {
    const watch = watchErrors(page);
    await page.goto(`/projects/${readState().projectId}?guest_mode=true`);
    await expect(page.locator('iframe').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Sign In to Workspace' })).toBeHidden();
    // No way into the team's workspace
    await expect(page.getByRole('button', { name: 'Team', exact: true })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Settings', exact: true })).toBeHidden();
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /All projects/ })).toBeHidden();
    watch.expectNone();
  });
});
