import { expect, test } from '@playwright/test';
import { seriousViolations } from './accessibility.js';
import { AppShellPage } from './pages/app-shell.page.js';
import { OrganizationsPage } from './pages/organizations.page.js';
import { ADMIN_STORAGE_STATE } from './storage-state.js';
import { expectTouchTarget, minimumTargetSize } from './touch-targets.js';

/**
 * End users of the demo dataset outside the demo organization, one per device, so the tests of
 * the devices running in parallel never move one person between their organizations.
 */
const END_USERS: Readonly<Record<string, { email: string; name: string }>> = {
  phone: { email: 'cyra.twardowski7@customer.example.com', name: 'Cyra Twardowski' },
  tablet: { email: 'joanna.ga8yka@customer.example.com', name: 'Joanna Gałka' },
  desktop: { email: 'izaak_bia8ykowski79@customer.example.com', name: 'Izaak Białkowski' },
};

/** A member of the demo organization "Customer company". */
const MEMBER_OF_DEMO_ORGANIZATION = 'teodor_m8yynarczyk@customer.example.com';

test.describe('organizations of the Administrator', () => {
  test.use({ storageState: ADMIN_STORAGE_STATE });

  test('creates an organization, manages its domains and members, archives and deletes it', async ({
    page,
  }, testInfo) => {
    const organizations = new OrganizationsPage(page);
    const stamp = `${testInfo.project.name}-${Date.now().toString(36)}`;
    const name = `E2E ${stamp}`;
    const endUser = END_USERS[testInfo.project.name] ?? END_USERS.desktop!;
    await organizations.goto();

    await organizations.create(name, `e2e-${stamp}.example.org`);

    await expect(page).toHaveURL(/\/admin\/organizations\/[\da-f-]+$/);
    await expect(organizations.heading).toHaveText(name);
    await expect(
      organizations.domains.getByText(`e2e-${stamp}.example.org`, { exact: true }),
    ).toBeVisible();

    // A public mail domain is rejected at the field.
    await organizations.addDomain('gmail.com');
    await expect(
      page.getByText('Public mail domains such as gmail.com cannot be added.'),
    ).toBeVisible();
    await expect(organizations.domainField).toHaveAttribute('aria-invalid', 'true');
    await organizations.addDomain(`shop.e2e-${stamp}.example.org`);
    // The domain is listed in its section; its toast repeats the text.
    await expect(
      organizations.domains.getByText(`shop.e2e-${stamp}.example.org`, { exact: true }),
    ).toBeVisible();

    await page.getByLabel('Project', { exact: true }).click();
    await page.getByRole('option', { name: /Customer portal/ }).click();
    await page.getByRole('button', { name: 'Add project' }).click();
    await expect(page.getByRole('button', { name: 'Remove Customer portal' })).toBeVisible();

    await organizations.addMember(endUser.email);
    await expect(organizations.members.filter({ hasText: endUser.name })).toBeVisible();

    // Removing offers Undo, which adds the person again.
    await page.getByRole('button', { name: `Remove ${endUser.name}` }).click();
    await expect(organizations.members).toHaveCount(0);
    await organizations.undo('removed from the organization').click();
    await expect(organizations.members.filter({ hasText: endUser.name })).toBeVisible();

    // A member of another organization is moved only after the confirmation.
    await organizations.addMember(MEMBER_OF_DEMO_ORGANIZATION);
    const move = page.getByRole('dialog', { name: /^Move / });
    await expect(move).toContainText('Moving them changes which tickets they can see.');
    await move.getByRole('button', { name: 'Cancel' }).click();
    await expect(organizations.members).toHaveCount(1);

    await page.getByRole('button', { name: 'Archive organization' }).click();
    await expect(organizations.archivedBanner).toBeVisible();
    await organizations.undo('Organization archived').click();
    await expect(organizations.archivedBanner).toBeHidden();

    await page.getByRole('button', { name: 'Archive organization' }).click();
    await expect(organizations.archivedBanner).toBeVisible();
    await expect(organizations.emailField).toHaveCount(0);
    await organizations.archivedBanner
      .getByRole('button', { name: 'Unarchive organization' })
      .click();
    await expect(organizations.archivedBanner).toBeHidden();

    // Deleting keeps the account of the member, who can join another organization again.
    await page.getByRole('button', { name: 'Delete organization' }).click();
    await page
      .getByRole('dialog', { name: `Delete ${name}?` })
      .getByRole('button', { name: 'Delete organization' })
      .click();
    await expect(page).toHaveURL('/admin/organizations');
    await expect(organizations.organization(name)).toHaveCount(0);
  });

  test('shows the organizations with access in the project settings', async ({ page }) => {
    const organizations = new OrganizationsPage(page);
    await page.goto('/projects');
    await page.getByRole('link', { name: /Customer portal/ }).click();

    const section = page.getByRole('region', { name: 'Organizations with access' });
    await section.getByRole('link', { name: /Customer company/ }).click();

    await expect(organizations.heading).toHaveText('Customer company');
  });

  test('passes axe, fits the viewport and has touch targets', async ({ page }, testInfo) => {
    const organizations = new OrganizationsPage(page);
    const shell = new AppShellPage(page);
    await organizations.goto();
    await expect(organizations.organization('Customer company')).toBeVisible();

    expect(await seriousViolations(page)).toEqual([]);
    expect(await shell.horizontalOverflow()).toBe(0);
    await expectTouchTarget(organizations.organization('Customer company'), 44);
    await expectTouchTarget(
      organizations.stateTabs.getByRole('tab', { name: 'Archived' }),
      minimumTargetSize(testInfo),
    );
    await expectTouchTarget(organizations.newOrganization, minimumTargetSize(testInfo));

    await organizations.organization('Customer company').click();
    await expect(organizations.heading).toHaveText('Customer company');
    await expect(organizations.members).toHaveCount(6);
    expect(await seriousViolations(page)).toEqual([]);
    expect(await shell.horizontalOverflow()).toBe(0);
    await expectTouchTarget(
      page.getByRole('button', { name: 'Add member' }),
      minimumTargetSize(testInfo),
    );
    await expectTouchTarget(
      page.getByRole('button', { name: 'Remove customer.example.com' }),
      minimumTargetSize(testInfo),
    );
  });

  test('is reached from the sections of the Administrator panel', async ({ page }) => {
    await page.goto('/admin');

    await page
      .getByRole('navigation', { name: 'Sections of the Administrator panel' })
      .getByRole('link', { name: 'Organizations' })
      .click();

    await expect(page).toHaveURL('/admin/organizations');
  });
});

test.describe('organizations of a Developer', () => {
  test('are not found', async ({ page }) => {
    const response = await page.goto('/admin/organizations');

    expect(response?.status()).toBe(404);
  });
});
