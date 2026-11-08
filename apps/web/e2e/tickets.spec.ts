import { devices, expect, test } from '@playwright/test';
import { seriousViolations } from './accessibility.js';
import { AppShellPage } from './pages/app-shell.page.js';
import { TicketPage } from './pages/ticket.page.js';
import { ADMIN_STORAGE_STATE } from './storage-state.js';
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
