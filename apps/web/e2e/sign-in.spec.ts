import { expect, test } from '@playwright/test';

// Without a session: the browser state of a person who has not signed in.
test.use({ storageState: { cookies: [], origins: [] }, locale: 'pl-PL' });

test('sends a visitor to the Keycloak login screen in their language', async ({ page }) => {
  await page.goto('/');

  await page.waitForURL(/\/auth\/realms\/trybun\/protocol\/openid-connect\/auth/);
  await expect(page.getByRole('heading', { name: 'Zaloguj się do systemu Trybun' })).toBeVisible();
});

test('returns a visitor to the opened view after the sign-in', async ({ page }) => {
  const signIn = page.waitForRequest((request) => new URL(request.url()).pathname === '/sign-in');

  await page.goto('/projects?state=archived');

  expect(new URL((await signIn).url()).searchParams.get('callbackUrl')).toBe(
    '/projects?state=archived',
  );
});

test('embeds no texts of a feature in the sign-in page', async ({ request }) => {
  const response = await request.get('/sign-in');

  expect(response.ok()).toBe(true);
  // A text of the `projects` namespace (§18.5): only the project views pass it to the browser.
  const html = await response.text();
  expect(html.includes('No projects yet.'), 'a text of the project views').toBe(false);
});
