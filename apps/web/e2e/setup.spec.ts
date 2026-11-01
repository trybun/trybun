import { expect, type Page, test } from '@playwright/test';
import { seriousViolations } from './accessibility.js';
import { AppShellPage } from './pages/app-shell.page.js';
import { SetupPage } from './pages/setup.page.js';

// The wizard needs no session.
test.use({ storageState: { cookies: [], origins: [] } });

const SETUP = { status: 'available', defaultLanguage: 'en', defaultTimeZone: 'Europe/Warsaw' };

/**
 * A fresh installation, simulated in the browser: the local environment has the Administrator of
 * the demo dataset, and creating one needs a fresh Keycloak (covered by the integration tests).
 */
async function freshInstallation(page: Page, administrator: { status: number; body?: object }) {
  await page.route('**/api/v1/setup', (route) => route.fulfill({ json: SETUP }));
  await page.route('**/api/v1/setup/token-verification', async (route) => {
    const { token } = route.request().postDataJSON() as { token: string };
    await (token === 'valid-token'
      ? route.fulfill({ json: SETUP })
      : route.fulfill({
          status: 404,
          contentType: 'application/problem+json',
          json: {
            type: 'about:blank',
            title: 'Not Found',
            status: 404,
            code: 'setup.token_invalid',
          },
        }));
  });
  await page.route('**/api/v1/setup/administrator', (route) =>
    route.fulfill({
      status: administrator.status,
      contentType: administrator.status >= 400 ? 'application/problem+json' : 'application/json',
      json: administrator.body ?? { id: '0199a3f0-0000-7000-8000-0000000000aa' },
    }),
  );
}

test.describe('first-run wizard', () => {
  test('says that Trybun is set up once an Administrator exists', async ({ page }) => {
    const setup = new SetupPage(page);
    await setup.goto('any-token');

    await expect(setup.message).toHaveText('Trybun is already set up');
    await expect(page.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/sign-in?callbackUrl=%2Fadmin',
    );
    expect(await seriousViolations(page)).toEqual([]);
  });

  test('rejects an invalid setup link', async ({ page }) => {
    await freshInstallation(page, { status: 201 });
    const setup = new SetupPage(page);
    await setup.goto('used-token');

    await expect(setup.message).toHaveText('This setup link is invalid or has expired');
    await expect(page.getByText('./trybun setup-token')).toBeVisible();
  });

  test('creates the first Administrator in one step', async ({ page }) => {
    await freshInstallation(page, { status: 201 });
    const setup = new SetupPage(page);
    await setup.goto('valid-token');

    await expect(setup.heading).toHaveText('Set up Trybun');
    // The brand, like the acceptance of an invitation and the login screen of Keycloak.
    await expect(page.getByRole('banner')).toContainText('trybun', { ignoreCase: true });
    await expect(page.getByText('default time zone: Europe/Warsaw')).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
    expect(await new AppShellPage(page).horizontalOverflow()).toBe(0);

    await setup.submit.click();
    await expect(setup.firstName).toHaveAttribute('aria-invalid', 'true');

    await setup.firstName.fill('Ada');
    await setup.lastName.fill('Admin');
    await setup.email.fill('ada@example.com');
    await setup.password.fill('correct horse battery staple');
    await setup.showPassword.click();
    await expect(setup.password).toHaveAttribute('type', 'text');
    const request = page.waitForRequest('**/api/v1/setup/administrator');
    await setup.submit.click();

    expect((await request).postDataJSON()).toEqual({
      token: 'valid-token',
      firstName: 'Ada',
      lastName: 'Admin',
      email: 'ada@example.com',
      password: 'correct horse battery staple',
      language: 'en',
      timeZone: 'Europe/Warsaw',
    });
    await expect(setup.message).toHaveText('Your account is ready');
  });

  test('states the password rule and refuses a short password before sending', async ({ page }) => {
    await freshInstallation(page, { status: 201 });
    const setup = new SetupPage(page);
    await setup.goto('valid-token');
    await expect(page.getByText('At least 15 characters.')).toBeVisible();
    let isSent = false;
    page.on('request', (request) => {
      isSent ||= request.url().endsWith('/api/v1/setup/administrator');
    });

    await setup.firstName.fill('Ada');
    await setup.lastName.fill('Admin');
    await setup.email.fill('ada@example.com');
    await setup.password.fill('fourteen chars');
    await setup.submit.click();

    await expect(setup.password).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText('Too short')).toBeVisible();
    expect(isSent).toBe(false);
  });

  test('shows a rule of the API at its field', async ({ page }) => {
    await freshInstallation(page, {
      status: 422,
      body: {
        type: 'about:blank',
        title: 'Unprocessable Content',
        status: 422,
        code: 'setup.email_taken',
        errors: [{ pointer: '/email', code: 'field.invalid' }],
      },
    });
    const setup = new SetupPage(page);
    await setup.goto('valid-token');

    await setup.firstName.fill('Ada');
    await setup.lastName.fill('Admin');
    await setup.email.fill('ada@example.com');
    await setup.password.fill('correct horse battery staple');
    await setup.submit.click();

    await expect(setup.email).toHaveAttribute('aria-invalid', 'true');
    await expect(
      page.getByText('An account with this e-mail address already exists.'),
    ).toBeVisible();
  });
});
