// A project from start to finish: create it, review the page with a pin, see the pin in every view,
// then delete it, restore it from Recently deleted and delete it again. Each browser uses its own project.
import { Page, expect, test } from '@playwright/test';
import { storageFor, watchErrors } from './support/helpers';
import { supabaseAdmin } from '../server/db';
import { PID, TEST_NAME } from './support/testData';

test.use({ storageState: storageFor('admin') });
test.describe.configure({ mode: 'serial' });

const SITES: Record<string, string> = { chromium: 'example.org', firefox: 'example.net', webkit: 'www.example.com' };

// Project cards are titled with the website address
const projectCard = (page: Page, site: string) =>
  page.locator('div').filter({ has: page.getByRole('heading', { name: site, exact: true }) }).filter({ has: page.getByRole('button', { name: 'Project options' }) }).last();

async function openTestFolder(page: Page) {
  await page.goto('/');
  await page.getByRole('heading', { name: PID, exact: true }).click();
}

test('create, pin, review in every view, delete and restore', async ({ page, browserName }) => {
  test.setTimeout(180_000);
  const watch = watchErrors(page);
  const site = SITES[browserName];
  const name = `${TEST_NAME} – ${browserName}`;

  // 1. New project
  await page.goto('/');
  await page.getByRole('button', { name: 'New Project' }).click();
  await expect(page.getByRole('heading', { name: 'New project' })).toBeVisible();
  // Required fields: Create stays unavailable until they are filled
  await page.getByPlaceholder('e.g. example.com or staging.example.com').fill(`https://${site}/`);
  await page.getByPlaceholder('Search or add, e.g. PRBS').fill(PID);
  // Pick the existing folder from the suggestions
  await page.getByText(PID, { exact: true }).last().click();
  await page.getByPlaceholder('e.g. AG-V44J288MWV').fill(`AG-E2E-${browserName.toUpperCase()}`);
  await page.getByPlaceholder('Uses the website address if empty').fill(name);
  await page.getByRole('button', { name: 'Create project' }).click();
  await expect(page.getByRole('heading', { name: 'New project' })).toBeHidden();

  // 2. It shows in the folder (the app goes there while it saves), and opens in the review canvas
  await expect(page).toHaveURL(/\/folders\//);
  await expect(projectCard(page, site), `the new project did not appear. ${watch.errors.join(' | ')}`).toBeVisible();
  await projectCard(page, site).getByRole('button', { name: 'Project options' }).click();
  await page.getByRole('button', { name: 'Open Studio & Annotate' }).click();
  await expect(page).toHaveURL(/\/projects\//);
  const projectUrl = page.url().split('?')[0];
  const frame = page.locator('iframe').first();
  await expect(frame).toBeVisible();
  await expect(page.frameLocator('iframe').first().getByText('documentation examples').first()).toBeVisible({ timeout: 30_000 });

  // 3. Drop a pin and post it
  const box = (await frame.boundingBox())!;
  // Placing a pin takes a screenshot of that spot automatically; wait for it so the pin is saved with it
  const shot = page.waitForResponse((r) => r.url().includes('/api/screenshot'), { timeout: 30_000 });
  await page.mouse.click(box.x + box.width / 2, box.y + 120);
  const note = page.getByPlaceholder('Describe the issue or the change you want...');
  await expect(note).toBeVisible();
  expect((await shot).ok(), 'automatic screenshot').toBeTruthy();
  await page.waitForTimeout(1000);
  await note.fill(`E2E pin from ${browserName}`);
  await page.getByRole('button', { name: /^Post Pin #\d+/ }).click();
  await expect(note).toBeHidden();
  await expect(page.locator('button[title^="Desktop: 1 pin"]')).toBeVisible();

  // 4. The pin shows in the comments, Kanban and Table views
  // The new pin's discussion opens by itself
  await expect(page.getByText(`E2E pin from ${browserName}`).filter({ visible: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Kanban', exact: true }).click();
  await expect(page.getByText(`E2E pin from ${browserName}`).filter({ visible: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Table', exact: true }).click();
  await expect(page.getByText(`E2E pin from ${browserName}`).filter({ visible: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Activity', exact: true }).click();
  await expect(page.getByRole('button', { name: 'All Events' })).toBeVisible();

  // 5. The screenshot is uploaded in the background after posting (leaving sooner loses it, see the test report);
  //    give it time, then reload: the pin and its screenshot were saved
  await expect.poll(async () => (await supabaseAdmin.from('pins').select('screenshot_url').eq('title', `E2E pin from ${browserName}`).single()).data?.screenshot_url, { timeout: 20_000, message: 'the pin was saved without its screenshot' }).toBeTruthy();
  await page.goto(`${projectUrl}/table`);
  await expect(page.getByText(`E2E pin from ${browserName}`).filter({ visible: true }).first()).toBeVisible();

  // 6. Delete → Recently deleted → Restore → delete again
  page.on('dialog', (d) => d.accept());
  await openTestFolder(page);
  await projectCard(page, site).getByRole('button', { name: 'Project options' }).click();
  // The card disappears straight away; wait until the server has actually moved the project to Recently deleted
  const deleted = page.waitForResponse((r) => /\/api\/projects\/[^/]+\/delete$/.test(r.url()));
  await page.getByRole('button', { name: /Delete (this )?project/i }).click();
  const confirm = page.getByRole('button', { name: /^Delete( project)?$/ });
  if (await confirm.isVisible().catch(() => false)) await confirm.click();
  expect((await deleted).ok()).toBeTruthy();
  await expect(projectCard(page, site)).toBeHidden();

  await page.goto('/');
  await page.getByRole('button', { name: /Recently deleted/ }).click();
  // Only ever the row named exactly like this test's project, and only if it holds a single Restore button:
  // the list also holds the team's real deleted projects, which the tests must never restore
  const row = page.getByText(name, { exact: true }).locator('xpath=ancestor::div[.//button[normalize-space()="Restore"]][1]');
  await expect(row).toHaveCount(1);
  await expect(row.getByRole('button', { name: 'Restore' })).toHaveCount(1);
  await expect(row).toContainText(name);
  const restored = page.waitForResponse((r) => /\/api\/projects\/[^/]+\/restore$/.test(r.url()));
  await row.getByRole('button', { name: 'Restore' }).click();
  expect((await restored).url()).toContain(new URL(projectUrl).pathname.split('/').pop()!);
  await page.keyboard.press('Escape');
  await openTestFolder(page);
  await expect(projectCard(page, site)).toBeVisible();
  await page.goto(`${projectUrl}/table`);
  await expect(page.getByText(`E2E pin from ${browserName}`).filter({ visible: true }).first()).toBeVisible();

  watch.expectNone();
});
