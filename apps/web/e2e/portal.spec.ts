import { expect, test } from '@playwright/test';
import { seriousViolations } from './accessibility.js';
import { AppShellPage } from './pages/app-shell.page.js';
import { PortalPage } from './pages/portal.page.js';
import { TicketPage } from './pages/ticket.page.js';
import {
  CUSTOMER_STORAGE_STATE,
  PARTNER_STORAGE_STATE,
  TEAM_STORAGE_STATE,
} from './storage-state.js';
import { waitForToastsToClose } from './toasts.js';
import { expectTouchTarget, minimumTargetSize } from './touch-targets.js';

/** A PNG of one pixel: an image the Worker checks, strips and releases in seconds (§13.3). */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

/** Whether a response answers a request of the attachments API (S1-08). */
function isAttachmentRequest(url: string): boolean {
  return new URL(url).pathname.startsWith('/api/v1/attachments');
}

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

  test('attaches an image to a new ticket, shows it inline after the check and deletes it (S1-08)', async ({
    page,
  }, testInfo) => {
    // The malware scan of the Worker runs between the upload and the inline image.
    test.slow();
    const portal = new PortalPage(page);
    const shell = new AppShellPage(page);
    await page.goto('/portal');
    await portal.createTicket.click();
    await portal.title.fill(`Screenshot of the error on ${testInfo.project.name}`);

    await portal.addFiles([{ name: 'screenshot.png', mimeType: 'image/png', buffer: PNG }]);

    await expect(portal.drafts.getByRole('listitem')).toHaveCount(1);
    await expect(portal.drafts).toContainText('screenshot.png');
    await expect(portal.description).toHaveValue(
      /^!\[screenshot\\\.png\]\(\/api\/v1\/attachments\/[0-9a-f-]{36}\/content\)$/,
    );
    expect(await seriousViolations(page)).toEqual([]);
    expect(await shell.horizontalOverflow()).toBe(0);
    await expectTouchTarget(portal.attachFiles, minimumTargetSize(testInfo), ['height', 'width']);
    await expectTouchTarget(
      portal.drafts.getByRole('button', { name: 'Delete screenshot.png' }),
      minimumTargetSize(testInfo),
      ['height', 'width'],
    );
    // The form can be saved while the file is being checked.
    await expect(portal.submit).toBeEnabled();
    await portal.submit.click();

    await expect(page).toHaveURL(/\/portal\/tickets\/CP-\d+$/);
    // The view polls the image until the check has released it, then shows it inline.
    const image = page
      .getByRole('region', { name: 'Description' })
      .getByRole('img', { name: 'screenshot.png' });
    await expect(image).toBeVisible({ timeout: 60_000 });
    await expect
      .poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth))
      .toBe(1);
    // The image opens in a new tab, so the application tab stays (§13.3).
    const attachmentLink = portal.attachments.getByRole('link', {
      name: 'screenshot.png (opens in a new tab)',
    });
    await expect(attachmentLink).toBeVisible();
    await expect(attachmentLink).toHaveAttribute('target', '_blank');
    expect(await seriousViolations(page)).toEqual([]);
    expect(await shell.horizontalOverflow()).toBe(0);
    await expectTouchTarget(
      portal.attachments.getByRole('button', { name: 'Delete screenshot.png' }),
      minimumTargetSize(testInfo),
      ['height', 'width'],
    );
    await waitForToastsToClose(page);

    await portal.deleteAttachment('screenshot.png');

    await expect(page.getByText('File screenshot.png deleted')).toBeVisible();
    await expect(portal.attachments).toHaveCount(0);
    await expect(portal.history.last()).toContainText(
      'Celina Customer deleted the file screenshot.png',
    );
    // Files attached while creating the ticket write no event (S1-08 Q16).
    await expect(portal.history.filter({ hasText: 'added the file' })).toHaveCount(0);
  });

  test('uploads 10 files of one selection without reaching the rate limit (S1-08 Q7)', async ({
    page,
  }, testInfo) => {
    test.slow();
    const portal = new PortalPage(page);
    const statuses: number[] = [];
    page.on('response', (response) => {
      if (isAttachmentRequest(response.url())) {
        statuses.push(response.status());
      }
    });
    await page.goto('/portal');
    await portal.createTicket.click();
    await portal.title.fill(`Ten log files of ${testInfo.project.name}`);

    await portal.addFiles(
      Array.from({ length: 10 }, (_, index) => ({
        name: `log-${index + 1}.txt`,
        mimeType: 'text/plain',
        buffer: Buffer.from(`Line ${index + 1} of the log\n`),
      })),
    );

    await expect(portal.drafts.getByRole('listitem')).toHaveCount(10);
    await expect(portal.submit).toBeEnabled();
    // The drafts are polled with one request at a time while they are being checked.
    await expect.poll(() => statuses.filter((status) => status === 200).length).toBeGreaterThan(0);
    // Submitting attaches the drafts, so the next run of the test starts below the draft quota.
    await portal.submit.click();
    await expect(page).toHaveURL(/\/portal\/tickets\/CP-\d+$/);
    await expect(portal.attachments.getByRole('listitem')).toHaveCount(10);
    expect(statuses.filter((status) => status === 201)).toHaveLength(10);
    expect(statuses).not.toContain(429);
  });

  test('refuses a file over the size limit before sending it (S1-08 Q2)', async ({ page }) => {
    const portal = new PortalPage(page);
    const uploads: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'POST' && isAttachmentRequest(request.url())) {
        uploads.push(request.url());
      }
    });
    await page.goto('/portal');
    await portal.createTicket.click();

    await portal.addFiles([
      { name: 'large.log', mimeType: 'text/plain', buffer: Buffer.alloc(26 * 1024 * 1024, 'a') },
    ]);

    await expect(page.getByText('The file is larger than 25 MB')).toBeVisible();
    await expect(page.getByText('large.log')).toBeVisible();
    await expect(portal.drafts).toHaveCount(0);
    await expect(portal.description).toHaveValue('');
    expect(uploads).toEqual([]);
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
    await expect(portal.history.nth(0)).toContainText('Celina Customer created the ticket');
    await expect(portal.history.nth(1)).toContainText('Status changed to In progress');
    await expect(page.getByText(/priority/i)).toHaveCount(0);
    expect(await seriousViolations(page)).toEqual([]);
    expect(await shell.horizontalOverflow()).toBe(0);
  });

  test('opens a ticket from the team address with a lower-case identifier', async ({ page }) => {
    const portal = new PortalPage(page);
    await page.goto('/portal/tickets');
    await portal.ticket('Wrong VAT rate on the March invoice').click();
    await expect(page).toHaveURL(/\/portal\/tickets\/CP-\d+$/);
    const identifier = new URL(page.url()).pathname.split('/').at(-1) ?? '';

    // The team address goes to the portal (S1-10), and the identifier to its upper case.
    await page.goto(`/tickets/${identifier.toLowerCase()}`);

    await expect(page).toHaveURL(`/portal/tickets/${identifier}`);
    await expect(portal.heading).toHaveText('Wrong VAT rate on the March invoice');
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

    // A press before the hydration does nothing (#191): press again while the question is shown.
    const question = page.getByRole('heading', { name: 'Is your problem solved?' });
    await expect(async () => {
      if (await question.isVisible()) {
        await page.getByRole('button', { name: 'Yes, solved' }).click();
      }
      await expect(page.getByText('Your ticket has been resolved')).toBeVisible({ timeout: 2_000 });
    }).toPass();

    await expect(question).toHaveCount(0);
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
  test('sends a team member to the team ticket view of a portal ticket', async ({ page }) => {
    const ticket = new TicketPage(page);
    await page.goto('/portal/tickets/CP-1');

    // The counterpart of the portal ticket is the team ticket view (S1-10).
    await expect(page).toHaveURL('/tickets/CP-1');
    await expect(ticket.heading).toBeVisible();
    await expect(ticket.details).toBeVisible();
  });
});

// Ticket visibility of S1-11 (§5.1, §5.2): a request to share with all customers, approved by the
// team, on phone, tablet and desktop, with axe.
test.describe('sharing a ticket with all customers', () => {
  test.use({ storageState: CUSTOMER_STORAGE_STATE });

  test('the customer asks to share a new ticket, and a Developer approves it after the reminder', async ({
    page,
    browser,
  }, testInfo) => {
    const portal = new PortalPage(page);
    const shell = new AppShellPage(page);
    const title = `Share the price list on ${testInfo.project.name} ${Date.now()}`;
    await page.goto('/portal');
    await portal.createTicket.click();
    await portal.title.fill(title);

    // Only me by default; All customers shows the warning of §5.1.
    const visibility = page.getByRole('radiogroup');
    await expect(visibility.getByRole('radio', { name: 'Only me' })).toBeChecked();
    await visibility.getByRole('radio', { name: 'All customers' }).click();
    await expect(
      page.getByText('Make sure the description and attachments contain no confidential data.'),
    ).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
    expect(await shell.horizontalOverflow()).toBe(0);
    // The whole label of a choice is its target.
    await expectTouchTarget(
      visibility.locator('label').filter({ hasText: 'All customers' }),
      minimumTargetSize(testInfo),
    );
    await portal.submit.click();

    await expect(page).toHaveURL(/\/portal\/tickets\/CP-\d+$/);
    const identifier = new URL(page.url()).pathname.split('/').at(-1) ?? '';
    // Celina belongs to Customer company, which has the project: her organization sees it while
    // the request waits (Q4).
    await expect(page.getByText('Visible to: My organization')).toBeVisible();
    await expect(
      page.getByText('Waiting for the team to share this ticket with all customers.'),
    ).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);

    const team = await browser.newContext({ storageState: TEAM_STORAGE_STATE });
    try {
      const developer = await team.newPage();
      await developer.goto(`/tickets/${identifier}`);
      await expect(developer.getByText('Sharing requested')).toBeVisible();
      const dialog = developer.getByRole('dialog', {
        name: `Share ${identifier} with all customers?`,
      });
      // The server-rendered button opens nothing before the hydration: pressed until it does.
      await expect(async () => {
        await developer.getByRole('button', { name: 'Share with all customers' }).click();
        await expect(dialog).toBeVisible({ timeout: 2_000 });
      }).toPass();
      await expect(
        dialog.getByText(
          'Check that the description and attachments contain no data identifying the customer.',
        ),
      ).toBeVisible();
      expect(await seriousViolations(developer)).toEqual([]);
      await dialog.getByRole('button', { name: 'Share with all customers' }).click();
      await expect(developer.getByText('Shared with all customers')).toBeVisible();
    } finally {
      await team.close();
    }

    await page.reload();
    await expect(page.getByText('Visible to: All customers')).toBeVisible();
    await expect(page.getByText('Shared with everyone')).toBeVisible();
  });
});
