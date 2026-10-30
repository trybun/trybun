import { type Browser, devices, expect, test } from '@playwright/test';
import { seriousViolations } from './accessibility.js';
import { AppShellPage } from './pages/app-shell.page.js';
import { SettingsPage } from './pages/settings.page.js';
import { SignInPage } from './pages/sign-in.page.js';
import { expectTouchTarget, minimumTargetSize } from './touch-targets.js';

/** A new device of the developer: a fresh browser that signs in, in English. */
async function newDevice(browser: Browser) {
  const context = await browser.newContext({
    ...devices['Desktop Chrome'],
    locale: 'en-US',
    storageState: { cookies: [], origins: [] },
  });
  const page = await context.newPage();
  await page.goto('/settings');
  await new SignInPage(page).signIn('developer@example.com');
  return { context, page, settings: new SettingsPage(page) };
}

test.describe('account settings', () => {
  test('are reached from the account menu', async ({ page }) => {
    const shell = new AppShellPage(page);
    await page.goto('/');

    await shell.accountMenu.click();
    await page.getByRole('menuitem', { name: 'Account settings' }).click();

    await expect(page).toHaveURL('/settings');
    await expect(new SettingsPage(page).heading('Account settings')).toBeVisible();
  });

  test('pass axe, fit the viewport and have touch targets', async ({ page }, testInfo) => {
    const settings = new SettingsPage(page);
    const shell = new AppShellPage(page);
    await settings.goto();
    await expect(settings.heading('Account settings')).toBeVisible();

    expect(await seriousViolations(page)).toEqual([]);
    expect(await shell.horizontalOverflow()).toBe(0);
    await expectTouchTarget(settings.language, minimumTargetSize(testInfo));
    await expectTouchTarget(settings.timeZone, minimumTargetSize(testInfo));
    await expectTouchTarget(settings.save, minimumTargetSize(testInfo));

    await settings.timeZone.fill('Warsaw');
    await expect(page.getByRole('option', { name: 'Europe/Warsaw' })).toBeVisible();
    // Options are compact only on a desktop with a precise pointer (§18.6).
    if (testInfo.project.name !== 'desktop') {
      await expectTouchTarget(page.getByRole('option', { name: 'Europe/Warsaw' }), 44);
    }
  });
});

test.describe('the language of the account', () => {
  // One account on several devices: on one device project only.

  test('renders at once after saving and follows the person to another device', async ({
    browser,
  }) => {
    test.skip(test.info().project.name !== 'desktop', 'The test opens the devices itself.');
    // Three sign-ins with one-time codes, which may wait for the next 30-second window.
    test.slow();
    // The demo account speaks Polish (demo dataset): the sign-in applies it.
    const first = await newDevice(browser);
    await expect(first.settings.heading('Ustawienia konta')).toBeVisible();

    await first.settings.chooseLanguage('English');
    await first.settings.chooseTimeZone('America/New_York');
    await first.settings.save.click();
    await expect(first.settings.heading('Account settings')).toBeVisible();

    try {
      const second = await newDevice(browser);
      await expect(second.settings.heading('Account settings')).toBeVisible();
      await expect(second.settings.timeZone).toHaveValue('America/New_York');
      await second.context.close();
    } finally {
      // The demo dataset again: Polish, Warsaw.
      await first.settings.chooseLanguage('Polski');
      await first.settings.chooseTimeZone('Europe/Warsaw');
      await first.settings.save.click();
      await expect(first.settings.heading('Ustawienia konta')).toBeVisible();
      await first.context.close();
    }
  });
});
