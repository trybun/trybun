import { expect, test } from '@playwright/test';

// Without a session: the browser state of a person who has not signed in.
test.use({ storageState: { cookies: [], origins: [] }, locale: 'pl-PL' });

test('sends a visitor to the Keycloak login screen in their language', async ({ page }) => {
  await page.goto('/');

  await page.waitForURL(/\/auth\/realms\/trybun\/protocol\/openid-connect\/auth/);
  await expect(page.getByRole('heading', { name: 'Zaloguj się do systemu Trybun' })).toBeVisible();
});
