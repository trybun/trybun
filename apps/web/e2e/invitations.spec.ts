import { expect, test } from '@playwright/test';
import { seriousViolations } from './accessibility.js';
import { AppShellPage } from './pages/app-shell.page.js';
import { InvitationPage } from './pages/invitation.page.js';
import { ProjectsPage } from './pages/projects.page.js';
import { MANAGER_STORAGE_STATE } from './storage-state.js';
import { expectTouchTarget, minimumTargetSize } from './touch-targets.js';

/** A password the policy of the realm accepts: 15+ characters, not a common one (§7.4). */
const PASSWORD = 'violet-harbour-lantern-42';

test.describe('invitations', () => {
  test.use({ storageState: MANAGER_STORAGE_STATE });

  test('a Project manager invites an end user, who accepts with a password and lands in the project', async ({
    page,
    browser,
    browserName,
  }, testInfo) => {
    // Two people, a Keycloak sign-in and a new account: longer than the default 30 seconds.
    test.slow();
    if (browserName === 'chromium') {
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    }
    const projects = new ProjectsPage(page);
    // Outside the domain of the demo organization, whose member count other tests check: the
    // person gets personal access to the project (§7.3).
    const email = `e2e-${testInfo.project.name}-${Date.now().toString(36)}@example.org`;
    await projects.goto();
    await projects.project('Customer portal').click();
    await projects.settingsTab('Members').click();

    const dialog = await projects.addByEmail(email, 'End user');

    await expect(dialog.getByText('This person gets an invitation link.')).toBeVisible();
    await dialog.evaluate((popup) =>
      Promise.all(popup.getAnimations({ subtree: true }).map((animation) => animation.finished)),
    );
    expect(await seriousViolations(page)).toEqual([]);
    await expectTouchTarget(
      dialog.getByRole('button', { name: 'Invite' }),
      minimumTargetSize(testInfo),
    );
    await dialog.getByRole('button', { name: 'Invite' }).click();

    // The same dialog shows the link once.
    const created = page.getByRole('dialog', { name: 'Invitation created' });
    await expect(created).toBeVisible();
    await expect(created.getByText(/^Only this link works\. It expires on /)).toBeVisible();
    const link = await created.getByLabel('Invitation link').inputValue();
    expect(link).toMatch(/\/invitations#token=[\w-]+$/);
    await created.getByRole('button', { name: 'Copy link' }).click();
    if (browserName === 'chromium') {
      await expect(page.getByText('Link copied')).toBeVisible();
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(link);
    }
    await created.getByRole('button', { name: 'Done' }).click();
    const pending = page.getByRole('region', { name: 'Pending invitations' });
    // Its own row: an invitation of an earlier run may still be pending.
    const row = pending.getByRole('listitem').filter({ hasText: email });
    await expect(row).toBeVisible();
    await expect(row.getByText('End user · Invited by Marek Manager')).toBeVisible();

    // The invited person, in a browser of their own.
    const visitor = await browser.newContext({
      ...testInfo.project.use,
      storageState: { cookies: [], origins: [] },
    });
    const visitorPage = await visitor.newPage();
    const invitation = new InvitationPage(visitorPage);
    await invitation.goto(link);

    await expect(invitation.heading).toHaveText('Accept the invitation');
    await expect(invitation.email).toHaveValue(email);
    await expect(invitation.email).toHaveAttribute('readonly', '');
    await expect(
      visitorPage.getByText('the project Customer portal, role: End user'),
    ).toBeVisible();
    await expect(visitorPage.getByText('Marek Manager')).toBeVisible();
    expect(await seriousViolations(visitorPage)).toEqual([]);
    expect(await new AppShellPage(visitorPage).horizontalOverflow()).toBe(0);
    await expectTouchTarget(invitation.accept, minimumTargetSize(testInfo));

    await invitation.acceptWithPassword('Ewa', 'Klientka', PASSWORD);

    // Keycloak asks for the password just set, with the invited address pre-filled.
    await expect(visitorPage.getByLabel('Username or email')).toHaveValue(email);
    await visitorPage.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await visitorPage.getByRole('button', { name: 'Sign In' }).click();

    // The landing of the project, which shows the home page until the project view exists.
    await expect(visitorPage).toHaveURL('/');
    const me = await visitorPage.request.get('/api/v1/users/me');
    expect(await me.json()).toMatchObject({ email, kind: 'end_user', displayName: 'Ewa Klientka' });
    await visitor.close();

    // The used link is gone from the pending invitations and is rejected when opened again.
    await page.reload();
    await expect(
      page.getByRole('region', { name: 'Pending invitations' }).getByText(email),
    ).toHaveCount(0);
    await new InvitationPage(page).goto(link);
    await expect(
      page.getByRole('heading', { name: 'This invitation link is not valid' }),
    ).toBeVisible();
  });

  test('rejects a link that is not valid', async ({ page }) => {
    const invitation = new InvitationPage(page);
    await invitation.goto('https://trybun.example.com/invitations#token=not-a-valid-token');

    await expect(
      page.getByRole('heading', { name: 'This invitation link is not valid' }),
    ).toBeVisible();
    await expect(page.getByText('Ask the person who invited you for a new link.')).toBeVisible();
  });
});
