// Signs in once per role and saves the session, so the other tests start signed in
import { test as setup } from '@playwright/test';
import { dashboardReady, signIn, storageFor } from './support/helpers';

for (const who of ['admin', 'member'] as const) {
  setup(`sign in as the test ${who}`, async ({ page }) => {
    await signIn(page, `vpin-e2e-${who}`);
    await dashboardReady(page);
    await page.context().storageState({ path: storageFor(who) });
  });
}
