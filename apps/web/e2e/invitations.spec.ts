import { expect, test } from '@playwright/test';
import { seriousViolations } from './accessibility.js';
import { AccountsPage } from './pages/accounts.page.js';
import { AppShellPage } from './pages/app-shell.page.js';
import { InvitationPage } from './pages/invitation.page.js';
import { ProjectsPage } from './pages/projects.page.js';
import { ADMIN_STORAGE_STATE, MANAGER_STORAGE_STATE } from './storage-state.js';
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

/**
 * The invitation to the Administrator role makes a team member, who signs in with GitHub. The
 * test environment has no GitHub sign-in, so the API refuses it (`invitation.github_sign_in_missing`,
 * `accounts.spec.ts`); these answers of the API stand in for an installation that has one.
 */
test.describe('invitation to the Administrator role', () => {
  test.use({ storageState: ADMIN_STORAGE_STATE });

  const INVITATION_ID = '0199a3f0-0000-7000-8000-0000000000b1';
  const TOKEN = 'administrator-invitation-token';

  test('the Administrator sends it and the invited person is offered GitHub only', async ({
    page,
    browser,
  }, testInfo) => {
    const email = `admin-${testInfo.project.name}@example.org`;
    const link = `https://trybun.example.com/invitations#token=${TOKEN}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await page.route('**/api/v1/invitation-previews', (route) =>
      route.fulfill({ json: { outcome: 'invite', organization: null } }),
    );
    await page.route('**/api/v1/invitations', async (route) => {
      if (route.request().method() !== 'POST') {
        return route.fallback();
      }
      expect(route.request().postDataJSON()).toEqual({ email, target: { type: 'administrator' } });
      return route.fulfill({
        status: 201,
        json: {
          outcome: 'invited',
          invitation: {
            id: INVITATION_ID,
            user: { id: '0199a3f0-0000-7000-8000-0000000000b2', email, displayName: null },
            target: { type: 'administrator' },
            invitedBy: { id: '0199a3f0-0000-7000-8000-0000000000b3', displayName: 'Ada Admin' },
            state: 'pending',
            expiresAt,
            createdAt: new Date().toISOString(),
            allowedActions: ['resend', 'revoke'],
          },
          link,
        },
      });
    });
    const accounts = new AccountsPage(page);
    await accounts.goto();

    const dialog = await accounts.openInvite();
    await dialog.getByRole('textbox', { name: 'E-mail address' }).fill(email);
    await dialog.getByRole('radio', { name: 'The Administrator role' }).check();
    await expect(dialog.getByText('This person gets an invitation link.')).toBeVisible();
    await dialog.getByRole('button', { name: 'Invite', exact: true }).click();

    const created = page.getByRole('dialog', { name: 'Invitation created' });
    await expect(created.getByLabel('Invitation link')).toHaveValue(link);
    await created.getByRole('button', { name: 'Done' }).click();

    // The invited person, in a browser of their own.
    const visitor = await browser.newContext({
      ...testInfo.project.use,
      storageState: { cookies: [], origins: [] },
    });
    const visitorPage = await visitor.newPage();
    await visitorPage.route('**/api/v1/invitations/token-verification', (route) =>
      route.fulfill({
        json: {
          email,
          kind: 'team',
          accountState: 'invited',
          target: { type: 'administrator' },
          invitedBy: { displayName: 'Ada Admin' },
          expiresAt,
        },
      }),
    );
    const invitation = new InvitationPage(visitorPage);
    await invitation.goto(link);

    await expect(invitation.heading).toHaveText('Accept the invitation');
    // The brand, like the login screen of Keycloak that follows.
    await expect(visitorPage.getByRole('banner')).toContainText('trybun', { ignoreCase: true });
    await expect(invitation.email).toHaveValue(email);
    await expect(visitorPage.getByText('the Administrator role')).toBeVisible();
    const github = visitorPage.getByRole('button', { name: 'Continue with GitHub' });
    await expect(github).toBeVisible();
    await expectTouchTarget(github, minimumTargetSize(testInfo));
    // A team member signs in with GitHub only: no password form.
    await expect(invitation.password).toHaveCount(0);
    expect(await seriousViolations(visitorPage)).toEqual([]);
    await visitor.close();
  });
});
