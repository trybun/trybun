import { type Browser, devices, expect, test } from '@playwright/test';
import { seriousViolations } from './accessibility.js';
import { AccountsPage } from './pages/accounts.page.js';
import { AppShellPage } from './pages/app-shell.page.js';
import { SignInPage } from './pages/sign-in.page.js';
import { ADMIN_STORAGE_STATE } from './storage-state.js';
import { expectTouchTarget, minimumTargetSize } from './touch-targets.js';

/**
 * End users of the demo dataset that no other test changes, one per device, so the tests of the
 * devices running in parallel never change one account twice. They have no Keycloak user, so a
 * reactivation returns them to "Invited" (§7.4).
 */
const END_USERS: Readonly<Record<string, string>> = {
  phone: 'Monika Witkowski',
  tablet: 'Walgierz Mierzejewski',
  desktop: 'Daria Rusin',
};

/** A fresh browser of a person who signs in with the seeded password and one-time code. */
async function signedInDevice(browser: Browser, email: string) {
  const context = await browser.newContext({
    ...devices['Desktop Chrome'],
    storageState: { cookies: [], origins: [] },
  });
  const page = await context.newPage();
  await page.goto('/');
  await new SignInPage(page).signIn(email);
  return { context, page };
}

test.describe('accounts of the Administrator', () => {
  test.use({ storageState: ADMIN_STORAGE_STATE });

  test('deactivates an account after a confirmation naming its effects, and reactivates it', async ({
    page,
  }, testInfo) => {
    const accounts = new AccountsPage(page);
    const name = END_USERS[testInfo.project.name] ?? END_USERS.desktop!;
    await accounts.goto();
    await accounts.find(name);

    await accounts.act(name, 'Deactivate');
    const dialog = page.getByRole('dialog', { name: `Deactivate ${name}?` });
    await expect(dialog).toContainText('signed out on every device at once');
    await expect(dialog).toContainText('pending invitations are revoked');
    await dialog.getByRole('button', { name: 'Deactivate' }).click();

    await expect(accounts.toast(`${name} is deactivated.`)).toBeVisible();
    await expect(accounts.account(name)).toContainText('Deactivated');

    await accounts.act(name, 'Reactivate');
    await expect(accounts.toast(`${name} is reactivated.`)).toBeVisible();
    // Without a Keycloak user the account is invited again (§7.4).
    await expect(accounts.account(name)).toContainText('Invited');
    await expect(accounts.account(name)).not.toContainText('Deactivated');
  });

  test('filters by kind and state in the URL and searches by name and address', async ({
    page,
  }) => {
    const accounts = new AccountsPage(page);
    await accounts.goto('?kind=team');

    await expect(accounts.account('Marek Manager')).toBeVisible();
    await expect(accounts.account('Teodor Młynarczyk')).toHaveCount(0);
    // A search typed before the page hydrated is lost (WebKit is slower), so type until the
    // list shows its results.
    await expect(async () => {
      await accounts.search.fill('');
      await accounts.search.fill('developer@example');
      await expect(accounts.account('Marek Manager')).toHaveCount(0, { timeout: 2_000 });
    }).toPass();
    await expect(accounts.account('Dorota Developer')).toHaveCount(1);

    await accounts.stateFilter.click();
    await page.getByRole('option', { name: 'Deactivated' }).click();
    await expect(page).toHaveURL('/admin/accounts?kind=team&state=deactivated');
  });

  test('offers no action on the own account', async ({ page }) => {
    const accounts = new AccountsPage(page);
    await accounts.goto();
    await accounts.find('Ada Admin');

    // The own account allows no action (§7.4): no menu at all.
    await expect(accounts.account('Ada Admin')).toContainText('Administrator');
    await expect(accounts.actionsOf('Ada Admin')).toHaveCount(0);
  });

  test('passes axe, fits the viewport and has touch targets', async ({ page }, testInfo) => {
    const accounts = new AccountsPage(page);
    const shell = new AppShellPage(page);
    await accounts.goto();
    await expect(accounts.account('Marek Manager')).toBeVisible();

    expect(await seriousViolations(page)).toEqual([]);
    expect(await shell.horizontalOverflow()).toBe(0);
    await expectTouchTarget(accounts.search, minimumTargetSize(testInfo));
    await expectTouchTarget(accounts.kindFilter, minimumTargetSize(testInfo));
    await expectTouchTarget(accounts.actionsOf('Marek Manager'), minimumTargetSize(testInfo), [
      'height',
      'width',
    ]);

    await accounts.actionsOf('Marek Manager').click();
    await expect(page.getByRole('menuitem', { name: 'Deactivate' })).toBeVisible();
    // Menu items are compact only on a desktop with a precise pointer (§18.6).
    if (testInfo.project.name !== 'desktop') {
      await expectTouchTarget(page.getByRole('menuitem', { name: 'Deactivate' }), 44);
    }
  });

  test('invites an address, copies the link, sees the pending invitation and revokes it', async ({
    page,
    browserName,
  }, testInfo) => {
    if (browserName === 'chromium') {
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    }
    const accounts = new AccountsPage(page);
    // Outside the domain of the demo organization, whose member count other tests check.
    const email = `e2e-accounts-${testInfo.project.name}-${Date.now().toString(36)}@example.org`;
    const target = 'Project Customer portal, End user';
    await accounts.goto();

    const dialog = await accounts.openInvite();
    await dialog.getByRole('textbox', { name: 'E-mail address' }).fill(email);
    // The Administrator role makes a team member, who signs in with GitHub – not configured in
    // the test environment, so the preview gives the reason and nothing can be sent.
    await dialog.getByRole('radio', { name: 'The Administrator role' }).check();
    await expect(dialog.getByText('Configure GitHub sign-in before inviting them.')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Invite', exact: true })).toBeDisabled();

    await dialog.getByRole('radio', { name: 'A project' }).check();
    await dialog.getByRole('combobox', { name: 'Project' }).fill('Customer');
    await page.getByRole('option', { name: /^Customer portal/ }).click();
    await expect(dialog.getByRole('combobox', { name: 'Role' })).toContainText('End user');
    await expect(dialog.getByText('This person gets an invitation link.')).toBeVisible();
    await dialog.evaluate((popup) =>
      Promise.all(popup.getAnimations({ subtree: true }).map((animation) => animation.finished)),
    );
    expect(await seriousViolations(page)).toEqual([]);
    // The whole label of a choice is its target.
    await expectTouchTarget(
      dialog.locator('label').filter({ hasText: 'A project' }),
      minimumTargetSize(testInfo),
    );
    await expectTouchTarget(
      dialog.getByRole('button', { name: 'Invite', exact: true }),
      minimumTargetSize(testInfo),
    );
    await dialog.getByRole('button', { name: 'Invite', exact: true }).click();

    const created = page.getByRole('dialog', { name: 'Invitation created' });
    await expect(created.getByText(/^Only this link works\. It expires on /)).toBeVisible();
    const link = await created.getByLabel('Invitation link').inputValue();
    expect(link).toMatch(/\/invitations#token=[\w-]+$/);
    await created.getByRole('button', { name: 'Copy link' }).click();
    if (browserName === 'chromium') {
      await expect(page.getByText('Link copied')).toBeVisible();
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(link);
    }
    await created.getByRole('button', { name: 'Done' }).click();

    // The new account is invited, with its pending invitation.
    await accounts.find(email);
    await expect(accounts.account(email)).toContainText('Invited');
    const pending = accounts.invitationsOf(email);
    await expect(pending).toContainText(target);
    await expect(pending).toContainText('Invited by Ada Admin');
    expect(await seriousViolations(page)).toEqual([]);
    expect(await new AppShellPage(page).horizontalOverflow()).toBe(0);
    const revoke = pending.getByRole('button', {
      name: `Revoke the invitation of ${email}, ${target}`,
    });
    await expectTouchTarget(revoke, minimumTargetSize(testInfo));

    await revoke.click();
    await page
      .getByRole('dialog', { name: `Revoke the invitation of ${email}?` })
      .getByRole('button', { name: 'Revoke' })
      .click();
    await expect(accounts.toast('Invitation revoked')).toBeVisible();

    // Without a working link, the account offers Invite for its address right away (§7.4).
    await expect(pending).toHaveCount(0);
    // A row of its own below the account's row on tablets and desktops, in the card on phones.
    await expect(
      page.getByText('No working invitation link.').filter({ visible: true }),
    ).toHaveCount(1);
    await page
      .getByRole('button', { name: `Invite ${email}` })
      .filter({ visible: true })
      .click();
    await expect(
      page.getByRole('dialog', { name: 'Invite' }).getByRole('textbox', { name: 'E-mail address' }),
    ).toHaveValue(email);
  });

  test('is reached from the sections of the Administrator panel', async ({ page }) => {
    await page.goto('/admin');

    await page
      .getByRole('navigation', { name: 'Sections of the Administrator panel' })
      .getByRole('link', { name: 'Accounts' })
      .click();

    await expect(page).toHaveURL('/admin/accounts');
    await expect(new AccountsPage(page).heading).toBeVisible();
  });
});

test.describe('deactivation of a signed-in person', () => {
  // One person signed in on another device; the account of the demo dataset is shared, so on one
  // device only.
  test.use({ storageState: ADMIN_STORAGE_STATE });

  test('ends the web sessions of the account at once', async ({ page, browser }) => {
    // Two sign-ins with one-time codes, which may wait for the next 30-second window.
    test.skip(
      test.info().project.name !== 'desktop',
      'The test opens a desktop browser of the other person itself.',
    );
    test.slow();
    const accounts = new AccountsPage(page);
    const leaver = await signedInDevice(browser, 'leaver@example.com');
    const sessionOf = async () =>
      (await (await leaver.page.request.get('/api/auth/session')).json()) as object;
    expect(await sessionOf()).toHaveProperty('expires');

    await accounts.goto();
    await accounts.find('Leon Leaver');
    await accounts.act('Leon Leaver', 'Deactivate');
    await page
      .getByRole('dialog', { name: 'Deactivate Leon Leaver?' })
      .getByRole('button', { name: 'Deactivate' })
      .click();
    await expect(accounts.toast('Leon Leaver is deactivated.')).toBeVisible();

    try {
      // The session row is gone, and the API refuses the account through the BFF.
      expect(await sessionOf()).toEqual({});
      expect((await leaver.page.request.get('/api/v1/users/me')).status()).toBe(401);
    } finally {
      await accounts.act('Leon Leaver', 'Reactivate');
      await expect(accounts.toast('Leon Leaver is reactivated.')).toBeVisible();
      await leaver.context.close();
    }
  });
});
