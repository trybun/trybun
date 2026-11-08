import { type APIRequestContext, devices, expect, request, test } from '@playwright/test';
import { seriousViolations } from './accessibility.js';
import { AppShellPage } from './pages/app-shell.page.js';
import { TicketPage } from './pages/ticket.page.js';
import { ADMIN_STORAGE_STATE, MANAGER_STORAGE_STATE, TEAM_STORAGE_STATE } from './storage-state.js';
import { expectTouchTarget, minimumTargetSize } from './touch-targets.js';

/**
 * "Sign-in page crashes on Safari" of the demo dataset (`apps/server/prisma/demo-dataset.ts`): the
 * third ticket of the Customer portal, created by Marek Manager, who then raised its priority and
 * assigned Dorota Developer.
 */
const IDENTIFIER = 'CP-3';
const TITLE = 'Sign-in page crashes on Safari';

const DESKTOP = { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } };

// The team ticket view of S1-10 on phone, tablet and desktop, with axe (§13.4).
test.describe('the team ticket view', () => {
  test('shows a ticket with its fields and its timeline, also from a lower-case address', async ({
    page,
  }, testInfo) => {
    const ticket = new TicketPage(page);
    const shell = new AppShellPage(page);

    await ticket.goto(IDENTIFIER.toLowerCase());

    await expect(page).toHaveURL(new RegExp(`/tickets/${IDENTIFIER}$`));
    await expect(ticket.heading).toHaveText(TITLE);
    await expect(ticket.details).toContainText('Critical');
    await expect(ticket.details).toContainText('Dorota Developer');
    await expect(ticket.description).toContainText('Safari 26 shows a blank page');
    await expect(ticket.timelineItems.first()).toContainText('Marek Manager opened the ticket');
    await expect(ticket.activity).toContainText(
      'Marek Manager changed the priority: Normal → Critical',
    );
    await expect(ticket.activity).toContainText('Marek Manager assigned Dorota Developer');
    expect(await seriousViolations(page)).toEqual([]);
    expect(await shell.horizontalOverflow()).toBe(0);
    await expectTouchTarget(ticket.copyIdentifier, minimumTargetSize(testInfo), [
      'height',
      'width',
    ]);
  });

  test('shows the not-found page for a ticket that does not exist', async ({ page }) => {
    const response = await new TicketPage(page).goto('CP-999999');

    expect(response?.status()).toBe(404);
  });

  // One person in two fresh browser contexts: the test opens both itself, so it runs in one
  // project only. The Administrator's setting changes no other test, which read the timeline as
  // the developer.
  test('the hide events setting persists per user', async ({ browser }) => {
    test.skip(test.info().project.name !== 'desktop', 'The test opens its own contexts.');

    const first = await browser.newContext({ ...DESKTOP, storageState: ADMIN_STORAGE_STATE });
    const firstTicket = new TicketPage(await first.newPage());
    await firstTicket.goto(IDENTIFIER);
    await expect(firstTicket.timelineItems.first()).toBeVisible();
    await firstTicket.setEventsHidden(true);
    await expect(firstTicket.eventsHidden).toBeVisible();
    await expect(firstTicket.timelineItems).toHaveCount(0);
    await first.close();

    const second = await browser.newContext({ ...DESKTOP, storageState: ADMIN_STORAGE_STATE });
    const page = await second.newPage();
    const eventRequests: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.endsWith('/activity-events')) {
        eventRequests.push(request.url());
      }
    });
    const secondTicket = new TicketPage(page);
    try {
      await secondTicket.goto(IDENTIFIER);

      await expect(secondTicket.eventsHidden).toBeVisible();
      await expect(secondTicket.hideEvents).toHaveAttribute('aria-checked', 'true');
      expect(eventRequests).toEqual([]);
    } finally {
      // The setting is the Administrator's on every device: it is turned off again.
      await secondTicket.setEventsHidden(false);
      await expect(secondTicket.timelineItems.first()).toContainText(
        'Marek Manager opened the ticket',
      );
      await second.close();
    }
  });
});

/**
 * Unassigned tickets of the demo dataset, one per device, so that the three projects running in
 * parallel never change the same ticket; the tests return each to unassigned.
 */
const UNASSIGNED_TICKET_OF_DEVICE: Record<string, string> = {
  phone: 'ERP-2',
  tablet: 'ERP-3',
  desktop: 'CP-12',
};

/** A ticket as the API answers it, with what a change needs. */
interface TicketReply {
  id: string;
  version: number;
  assignee: { id: string; displayName: string | null } | null;
}

/**
 * The API through the BFF in the name of the account of `storageState`, with the `Origin` that
 * state-changing requests need (§14.4).
 */
function apiAs(storageState: string, baseURL: string): Promise<APIRequestContext> {
  return request.newContext({
    baseURL,
    storageState,
    extraHTTPHeaders: { Origin: new URL(baseURL).origin },
  });
}

async function ticketOf(api: APIRequestContext, identifier: string): Promise<TicketReply> {
  const response = await api.get(`/api/v1/tickets?identifier=${identifier}`);
  expect(response.status()).toBe(200);
  const [ticket] = ((await response.json()) as { items: TicketReply[] }).items;
  expect(ticket).toBeDefined();
  return ticket!;
}

/** Sets the assignee with `PATCH` and the current version; returns the response status. */
async function setAssignee(
  api: APIRequestContext,
  identifier: string,
  assigneeId: string | null,
): Promise<number> {
  const ticket = await ticketOf(api, identifier);
  const response = await api.patch(`/api/v1/tickets/${ticket.id}`, {
    headers: { 'If-Match': `W/"${ticket.version}"` },
    data: { assigneeId },
  });
  return response.status();
}

async function idOf(api: APIRequestContext): Promise<string> {
  return ((await (await api.get('/api/v1/users/me')).json()) as { id: string }).id;
}

// "A Developer can assign only themselves" (S1-10, §7.5): in the view on phone, tablet and
// desktop; the full form follows with the form.
test.describe('assignment in the team ticket view', () => {
  test('a Developer can assign only themselves', async ({ page, baseURL }, testInfo) => {
    const identifier = UNASSIGNED_TICKET_OF_DEVICE[testInfo.project.name] ?? 'CP-12';
    const manager = await apiAs(MANAGER_STORAGE_STATE, baseURL ?? '');
    // The developer of the device projects, through the same BFF as the page.
    const developer = await apiAs(TEAM_STORAGE_STATE, baseURL ?? '');
    const managerId = await idOf(manager);
    const developerId = await idOf(developer);
    const ticket = new TicketPage(page);
    try {
      // Someone else works on the ticket: the Developer takes it over.
      expect(await setAssignee(manager, identifier, managerId)).toBe(200);
      await ticket.goto(identifier);
      await expect(ticket.details).toContainText('Marek Manager');
      await expect(ticket.assigneePicker).toHaveCount(0);

      const saved = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname.startsWith('/api/v1/tickets/') &&
          response.request().method() === 'PATCH',
      );
      await expect(async () => {
        await ticket.assignToMe.click();
        await expect(ticket.unassignMe).toBeVisible({ timeout: 2_000 });
      }).toPass();
      expect((await saved).status()).toBe(200);
      await expect(ticket.details).toContainText('Dorota Developer');
      // Its inverse would assign someone else, which the Developer may not: no Undo (Q10).
      await expect(ticket.toast('Assigned to you')).toBeVisible();
      await expect(
        ticket.toast('Assigned to you').getByRole('button', { name: 'Undo' }),
      ).toHaveCount(0);
      expect((await ticketOf(developer, identifier)).assignee?.id).toBe(developerId);

      // The API refuses the Developer any other assignee, while the same requests may unassign
      // the Developer – so the refusal is the permission's, not the CSRF check's (§14.4).
      expect(await setAssignee(developer, identifier, managerId)).toBe(403);
      expect((await ticketOf(developer, identifier)).assignee?.id).toBe(developerId);
      expect(await setAssignee(developer, identifier, null)).toBe(200);
    } finally {
      expect(await setAssignee(manager, identifier, null)).toBe(200);
      await Promise.all([manager.dispose(), developer.dispose()]);
    }
  });

  test.describe('as a Project manager', () => {
    test.use({ storageState: MANAGER_STORAGE_STATE });

    test('a Project manager assigns anyone from the picker, and Undo returns', async ({
      page,
      baseURL,
    }, testInfo) => {
      const identifier = UNASSIGNED_TICKET_OF_DEVICE[testInfo.project.name] ?? 'CP-12';
      const manager = await apiAs(MANAGER_STORAGE_STATE, baseURL ?? '');
      const ticket = new TicketPage(page);
      try {
        await ticket.goto(identifier);
        await expect(ticket.details).toContainText('Unassigned');

        await ticket.assign('Dorota Developer');

        // The phone's picker is a button that names the assignee, the combobox shows the name.
        await (testInfo.project.name === 'phone'
          ? expect(ticket.assigneePicker).toHaveAccessibleName('Assignee: Dorota Developer')
          : expect(ticket.assigneePicker).toHaveValue('Dorota Developer'));
        const toast = ticket.toast('Assigned to Dorota Developer');
        await expect(toast).toBeVisible();
        expect(await seriousViolations(page)).toEqual([]);
        await expectTouchTarget(ticket.assigneePicker, minimumTargetSize(testInfo));

        const undone = page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname.startsWith('/api/v1/tickets/') &&
            response.request().method() === 'PATCH',
        );
        await toast.getByRole('button', { name: 'Undo' }).click();
        expect((await undone).status()).toBe(200);
        expect((await ticketOf(manager, identifier)).assignee).toBeNull();
      } finally {
        expect(await setAssignee(manager, identifier, null)).toBe(200);
        await manager.dispose();
      }
    });
  });
});
