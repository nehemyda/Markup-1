// The login page and who gets in: everything here starts signed out
import { expect, test } from '@playwright/test';
import { dashboardReady, signIn, watchErrors } from './support/helpers';
import { supabaseAdmin } from '../server/db';
import { EMAILS, readState, signoutEmail } from './support/testData';

test.describe('login page', () => {
  test('shows every sign-in option without errors', async ({ page }) => {
    const watch = watchErrors(page);
    await page.goto('/');
    await expect(page).toHaveTitle(/V ?Pins?/i);
    await expect(page.getByRole('heading', { name: /Website review/ })).toBeVisible();
    await expect(page.getByPlaceholder('your.name')).toBeVisible();
    await expect(page.getByLabel('Email domain')).toBeVisible();
    await expect(page.locator('input[type=password]')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Forgot?' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In to Workspace' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
    // The domain picker lists the workspace's allowed domains
    const domains = await page.getByLabel('Email domain').locator('option').allInnerTexts();
    expect(domains.join(' ')).toContain('yourdigitalagents.com');
    watch.expectNone();
  });

  test('the domain picker offers the workspace\'s allowed domains', async ({ page }) => {
    const { data } = await supabaseAdmin.from('settings').select('value').eq('id', 'access').single();
    const saved = (data?.value?.allowedDomains || []).map((d: string) => `@${d}`);
    await page.goto('/');
    await expect(page.getByLabel('Email domain').locator('option')).toHaveText([...saved, 'Other email…']);
  });

  test('Create Account asks for a name', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(page.getByPlaceholder('Jane Doe')).toBeVisible();
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await expect(page.getByPlaceholder('Jane Doe')).toBeHidden();
  });

  test('Forgot? without an email explains what to do', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Forgot?' }).click();
    await expect(page.getByText('Enter your email address above')).toBeVisible();
  });

  test('a wrong password is refused with a clear message', async ({ page }) => {
    await signIn(page, 'vpin-e2e-member', 'not-the-password');
    await expect(page.getByText('Incorrect email or password.')).toBeVisible();
    await expect(page.getByRole('heading', { name: /All projects/ })).toBeHidden();
  });

  test('someone outside the workspace is refused', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Email domain').selectOption({ label: 'Other email…' });
    await page.getByPlaceholder('name@company.com').fill(EMAILS.outsider);
    await page.locator('input[type=password]').fill(readState().password);
    await page.getByRole('button', { name: 'Sign In to Workspace' }).click();
    await expect(page.getByText(/not allowed in this workspace|Access denied/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: /All projects/ })).toBeHidden();
  });

  test('signed-out visitors opening an inside link see the login page', async ({ page }) => {
    for (const path of ['/settings', '/team', `/projects/${readState().projectId}`]) {
      await page.goto(path);
      await expect(page.getByRole('button', { name: 'Sign In to Workspace' })).toBeVisible();
    }
  });

  test('someone signs in, reloads and stays signed in, then signs out', async ({ page, browserName }) => {
    const watch = watchErrors(page);
    await signIn(page, signoutEmail(browserName).split('@')[0]);
    await dashboardReady(page);
    await page.reload();
    await dashboardReady(page);
    await page.getByRole('button', { name: /E2E (signout|s)/ }).first().click();
    await page.getByText('Sign Out / Switch Account').click();
    await expect(page.getByRole('button', { name: 'Sign In to Workspace' })).toBeVisible();
    watch.expectNone();
  });
});
