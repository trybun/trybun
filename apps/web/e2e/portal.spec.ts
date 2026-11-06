import { expect, test } from '@playwright/test';
import { seriousViolations } from './accessibility.js';
import { AppShellPage } from './pages/app-shell.page.js';
import { PortalPage } from './pages/portal.page.js';
import { CUSTOMER_STORAGE_STATE, PARTNER_STORAGE_STATE } from './storage-state.js';
import { expectTouchTarget, minimumTargetSize } from './touch-targets.js';

// The end-user portal of S1-09 (§5.7) on phone, tablet and desktop, with axe (§13.4).
test.describe('the portal of an end user with one project', () => {
  test.use({ storageState: CUSTOMER_STORAGE_STATE });

  test('opens the only project directly, without a choice of projects', async ({
    page,
  }, testInfo) => {
    const portal = new PortalPage(page);
    const shell = new AppShellPage(page);
    await page.goto('/');

    await expect(page).toHaveURL(/\/portal\/projects\/[0-9a-f-]+$/);
    await expect(portal.heading).toHaveText('Customer portal');
    await expect(shell.navigation.getByRole('link', { name: 'Projects' })).toHaveCount(0);
    await expect(shell.navigation.getByRole('link', { name: 'My tickets' })).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
    expect(await shell.horizontalOverflow()).toBe(0);
    await expectTouchTarget(portal.createTicket, minimumTargetSize(testInfo));
  });

  test('creates a ticket in two steps from the project home', async ({ page }, testInfo) => {
    const portal = new PortalPage(page);
    const shell = new AppShellPage(page);
    await page.goto('/portal');
    const title = `Login fails on ${testInfo.project.name}`;

    // Step 1.
    await portal.createTicket.click();
    await expect(portal.heading).toHaveText('New ticket');
    // The end-user template is the placeholder of the description (§3.4).
    await expect(portal.description).toHaveAttribute('placeholder', /^What happened\?/);
    expect(await seriousViolations(page)).toEqual([]);
    expect(await shell.horizontalOverflow()).toBe(0);
    await expectTouchTarget(portal.submit, minimumTargetSize(testInfo));
    // Step 2.
    await portal.title.fill(title);
    await portal.submit.click();

    await expect(page).toHaveURL(/\/portal\/tickets\/CP-\d+$/);
    await expect(page.getByText(/^Ticket CP-\d+ created$/)).toBeVisible();
    await expect(portal.heading).toHaveText(title);
    await expect(page.getByText('We have received your ticket')).toBeVisible();
  });

  test('lists the tickets awaiting a reply first in My tickets', async ({ page }, testInfo) => {
    const portal = new PortalPage(page);
    const shell = new AppShellPage(page);
    await page.goto('/portal');
    await shell.navigation.getByRole('link', { name: 'My tickets' }).click();

    await expect(portal.heading).toHaveText('My tickets');
    await expect(
      portal.group('Awaiting your reply').getByText('Export the delivery notes'),
    ).toBeVisible();
    await expect(
      portal.group('Other tickets').getByText('Wrong VAT rate on the March invoice'),
    ).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
    expect(await shell.horizontalOverflow()).toBe(0);
    await expectTouchTarget(
      portal.ticket('Export the delivery notes'),
      minimumTargetSize(testInfo),
    );
  });

  test('shows only the public status changes of a ticket (§4.5)', async ({ page }) => {
    const portal = new PortalPage(page);
    const shell = new AppShellPage(page);
    await page.goto('/portal/tickets');
    await portal.ticket('Wrong VAT rate on the March invoice').click();

    await expect(portal.heading).toHaveText('Wrong VAT rate on the March invoice');
    await expect(page.getByText('We are testing the solution')).toBeVisible();
    // The ticket moved to in progress and then to verification, and its priority and assignee
    // changed: only the change of the public status reaches the requester.
    await expect(portal.history).toHaveCount(2);
    await expect(portal.history.nth(0)).toContainText('You created this ticket');
    await expect(portal.history.nth(1)).toContainText('Status changed to In progress');
    await expect(page.getByText(/priority/i)).toHaveCount(0);
    expect(await seriousViolations(page)).toEqual([]);
    expect(await shell.horizontalOverflow()).toBe(0);
  });

  test('keeps the account settings in the portal', async ({ page }) => {
    await page.goto('/settings');

    await expect(page).toHaveURL('/portal/settings');
    await expect(new PortalPage(page).heading).toHaveText('Account settings');
  });

  test('answers the resolution question of a ticket', async ({ page }, testInfo) => {
    // The answer changes the shared demo ticket, so one device answers it.
    test.skip(testInfo.project.name !== 'desktop', 'The answer changes the demo ticket');
    const portal = new PortalPage(page);
    await page.goto('/portal/tickets');
    const ticketUrl = await portal.ticket('Cannot change my password').getAttribute('href');

    // The page of the e-mail link changes nothing until the answer is pressed (§4.3).
    await page.goto(`${ticketUrl}/resolution-confirmation?answer=not_solved`);
    await expect(page.getByRole('button', { name: 'No, still a problem' })).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
    await page.goto(ticketUrl ?? '/');
    await expect(page.getByRole('heading', { name: 'Is your problem solved?' })).toBeVisible();

    await page.getByRole('button', { name: 'Yes, solved' }).click();

    await expect(page.getByText('Thank you. The ticket is resolved.')).toBeVisible();
    await expect(page.getByText('Your ticket has been resolved')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Is your problem solved?' })).toHaveCount(0);
  });
});

test.describe('the portal of an end user with two projects', () => {
  test.use({ storageState: PARTNER_STORAGE_STATE });

  test('lists the projects to choose from', async ({ page }, testInfo) => {
    const shell = new AppShellPage(page);
    await page.goto('/');

    await expect(page).toHaveURL('/portal');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your projects');
    await expect(page.getByRole('link', { name: 'Customer portal' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'ERP' })).toBeVisible();
    await expect(shell.navigation.getByRole('link', { name: 'Projects' })).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
    expect(await shell.horizontalOverflow()).toBe(0);
    await expectTouchTarget(page.getByRole('link', { name: 'ERP' }), minimumTargetSize(testInfo));
  });
});

test.describe('the portal and a team member', () => {
  test('sends a team member back to the team views', async ({ page }) => {
    await page.goto('/portal/tickets/CP-1');

    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Home' })).toBeVisible();
  });
});
