import { type APIRequestContext, devices, expect, request, test } from '@playwright/test';
import { seriousViolations } from './accessibility.js';
import { AppShellPage } from './pages/app-shell.page.js';
import { TEMPLATES, TicketFormPage } from './pages/ticket-form.page.js';
import { TicketPage } from './pages/ticket.page.js';
import {
  ADMIN_STORAGE_STATE,
  CUSTOMER_STORAGE_STATE,
  MANAGER_STORAGE_STATE,
  TEAM_STORAGE_STATE,
} from './storage-state.js';
import { expectTouchTarget, minimumTargetSize } from './touch-targets.js';

/**
 * "Sign-in page crashes on Safari" of the demo dataset (`apps/server/prisma/demo-dataset.ts`): the
 * third ticket of the Customer portal, created by Marek Manager, who then raised its priority and
 * assigned Dorota Developer.
 */
const IDENTIFIER = 'CP-3';
const TITLE = 'Sign-in page crashes on Safari';

const DESKTOP = { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } };

/**
 * `TABLET_MEDIA_QUERY` of `@trybun/ui` (48rem): the field pickers are bottom sheets below it. The
 * tablet project (656 px in portrait) is below it too, so tests branch on the width, never on the
 * project name.
 */
const TABLET_BREAKPOINT_PX = 768;

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
 * Unassigned tickets of the demo dataset that no other test reads, one per test and device: the
 * tests and the three device projects run in parallel (`fullyParallel`), so no two of them ever
 * change the same ticket. The tests return each to unassigned.
 */
const UNASSIGNED_TICKETS: Record<'developer' | 'manager', Record<string, string>> = {
  developer: { phone: 'CP-2', tablet: 'CP-5', desktop: 'ERP-2' },
  manager: { phone: 'ERP-3', tablet: 'CP-12', desktop: 'CP-13' },
};

/** The unassigned ticket of the test of `role` on the device of the running project. */
function unassignedTicketOf(role: 'developer' | 'manager', project: string): string {
  const identifier = UNASSIGNED_TICKETS[role][project];
  expect(identifier, `an unassigned ticket on ${project}`).toBeDefined();
  return identifier!;
}

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
    const identifier = unassignedTicketOf('developer', testInfo.project.name);
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
      const identifier = unassignedTicketOf('manager', testInfo.project.name);
      const manager = await apiAs(MANAGER_STORAGE_STATE, baseURL ?? '');
      const ticket = new TicketPage(page);
      try {
        await ticket.goto(identifier);
        await expect(ticket.details).toContainText('Unassigned');

        await ticket.assign('Dorota Developer');

        // Below the tablet breakpoint (48rem, also the tablet project in portrait) the picker is a
        // sheet's button that names the assignee; from it on, the combobox shows the name.
        await ((page.viewportSize()?.width ?? 0) < TABLET_BREAKPOINT_PX
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
        // Undo closes its toast at once, so it cannot be pressed twice.
        await expect(toast).toBeHidden();
        expect((await undone).status()).toBe(200);
        expect((await ticketOf(manager, identifier)).assignee).toBeNull();
      } finally {
        expect(await setAssignee(manager, identifier, null)).toBe(200);
        await manager.dispose();
      }
    });
  });
});

/** The ID of an active project of the demo dataset by its name. */
async function projectIdOf(api: APIRequestContext, name: string): Promise<string> {
  const response = await api.get('/api/v1/projects?state=active');
  expect(response.status()).toBe(200);
  const { items } = (await response.json()) as { items: { id: string; name: string }[] };
  const project = items.find((candidate) => candidate.name === name);
  expect(project, name).toBeDefined();
  return project!.id;
}

// The full ticket form of S1-10 on phone, tablet and desktop, with axe (§13.4). The tests read
// shared data only, except the new tickets, which have titles of their own.
test.describe('the full ticket form', () => {
  test('New ticket in the team header opens the form', async ({ page }, testInfo) => {
    const newTicket = page.getByRole('banner').getByRole('link', { name: 'New ticket' });
    await page.goto('/');

    await expectTouchTarget(newTicket, minimumTargetSize(testInfo), ['height', 'width']);
    // A link of the server-rendered header: repeated until the hydrated link navigates.
    await expect(async () => {
      await newTicket.click();
      await expect(page).toHaveURL(/\/tickets\/new$/, { timeout: 2_000 });
    }).toPass();
    await expect(new TicketFormPage(page).heading).toHaveText('New ticket');
  });

  test('changing the type with an unchanged description replaces the template; with an edited one it never does', async ({
    page,
  }, testInfo) => {
    const form = new TicketFormPage(page);
    await form.goto();
    // The Developer's account speaks Polish (demo dataset), which the settings test switches for
    // a moment: the expectations follow the language the form inserted.
    const templates = TEMPLATES[await form.insertedLanguage()];
    await expect(form.type('Task')).toBeChecked();
    await expect(form.priority).toContainText('Normal');

    await form.chooseType('Question');
    await expect(form.description).toHaveValue(templates.question);
    await expect(form.priority).toContainText('Low');
    await form.chooseType('Bug');
    await expect(form.description).toHaveValue(templates.bug);
    await expect(form.priority).toContainText('Normal');
    expect(await seriousViolations(page)).toEqual([]);
    await expectTouchTarget(
      page.locator('label').filter({ has: form.type('Bug') }),
      minimumTargetSize(testInfo),
    );
    await expectTouchTarget(form.submit, minimumTargetSize(testInfo));

    const edited = `${templates.bug}\nSafari 26 on an iPad`;
    await form.fillDescription(edited);
    await form.chooseType('Question');
    await expect(form.description).toHaveValue(edited);
    await form.chooseType('Task');
    await expect(form.description).toHaveValue(edited);
  });

  test('Back with a typed description asks first; Keep editing keeps the text (Q10)', async ({
    page,
  }, testInfo) => {
    const form = new TicketFormPage(page);
    // The page Back returns to.
    await page.goto('/');
    await form.goto();
    const templates = TEMPLATES[await form.insertedLanguage()];
    const text = `${templates.task}\nBack on ${testInfo.project.name}`;
    await form.fillDescription(text);
    await expect(form.description).toHaveValue(text);
    // The guard's history entry, above the form's own, is in place before Back is pressed.
    await page.waitForFunction(
      () => (window.history.state as Record<string, unknown> | null)?.__trybunUnsavedChanges,
    );
    const question = page.getByRole('dialog', { name: 'Discard your changes?' });

    await page.goBack();
    await expect(question).toBeVisible();
    await expect(page).toHaveURL(/\/tickets\/new$/);
    await question.getByRole('button', { name: 'Keep editing' }).click();
    await expect(question).toHaveCount(0);
    await expect(form.description).toHaveValue(text);

    await page.goBack();
    await question.getByRole('button', { name: 'Discard' }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('a Developer sees only the Assign to me checkbox, and the new ticket opens in its view', async ({
    page,
    baseURL,
  }, testInfo) => {
    const developer = await apiAs(TEAM_STORAGE_STATE, baseURL ?? '');
    const erp = await projectIdOf(developer, 'ERP');
    await developer.dispose();
    const form = new TicketFormPage(page);
    await form.goto(erp);

    await expect(form.project).toContainText('ERP');
    await form.checkAssignToMe();
    await expect(form.assigneePicker).toHaveCount(0);
    expect(await seriousViolations(page)).toEqual([]);
    const title = `Full form on ${testInfo.project.name} ${Date.now()}`;
    await form.title.fill(title);
    await expect(form.title).toHaveValue(title);
    const created = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/v1/tickets' &&
        response.request().method() === 'POST',
    );
    await form.submit.click();
    expect((await created).status()).toBe(201);

    await expect(page).toHaveURL(/\/tickets\/ERP-\d+$/);
    const ticket = new TicketPage(page);
    await expect(ticket.heading).toHaveText(title);
    await expect(ticket.details).toContainText('Dorota Developer');
    await expect(ticket.toast('created')).toContainText(/^Ticket ERP-\d+ created/);
  });

  test.describe('as a Project manager whose language is Polish', () => {
    test.use({ storageState: MANAGER_STORAGE_STATE });

    test('the template appears in Polish, and the picker offers anyone', async ({
      page,
      baseURL,
    }) => {
      const manager = await apiAs(MANAGER_STORAGE_STATE, baseURL ?? '');
      const me = (await (await manager.get('/api/v1/users/me')).json()) as { language: string };
      // The demo dataset; no test changes the manager's language.
      expect(me.language).toBe('pl');
      const erp = await projectIdOf(manager, 'ERP');
      await manager.dispose();
      const form = new TicketFormPage(page);
      await form.goto(erp);

      // The page speaks the browser's language, the template the account's (S1-10 Q4).
      await expect(form.heading).toHaveText('New ticket');
      await expect(form.description).toHaveValue(TEMPLATES.pl.task);
      await form.chooseType('Bug');
      await expect(form.description).toHaveValue(TEMPLATES.pl.bug);
      await expect(form.assigneePicker).toBeVisible();
      await expect(form.assignToMe).toHaveCount(0);
      expect(await seriousViolations(page)).toEqual([]);
    });
  });

  test.describe('as an end user', () => {
    test.use({ storageState: CUSTOMER_STORAGE_STATE });

    test('has no New ticket in the header and goes from the form to the portal', async ({
      page,
    }) => {
      await page.goto('/tickets/new');

      // The portal root, which takes the demo customer with a single project into it (S1-09).
      await expect(page).toHaveURL(/\/portal\/projects\/[0-9a-f-]+$/);
      await expect(page.getByRole('banner').getByRole('link', { name: 'New ticket' })).toHaveCount(
        0,
      );
    });
  });
});
