import { type APIRequestContext, expect, request, test } from '@playwright/test';
import { seriousViolations } from './accessibility.js';
import { TEAM_STORAGE_STATE } from './storage-state.js';
import { expectTouchTarget, minimumTargetSize } from './touch-targets.js';

/**
 * `TABLET_MEDIA_QUERY` of `@trybun/ui` (48rem): below it the bulk pickers are bottom sheets, and
 * the list is cards below `md` – the same width.
 */
const TABLET_BREAKPOINT_PX = 768;

/** A pending sharing request of the demo dataset, in the Customer portal (S1-11). */
const PENDING_TITLE = 'Show the delivery date on the order page';

/** The `xl` breakpoint of Tailwind (80rem): the table shows the type column from it on. */
const DESKTOP_BREAKPOINT_PX = 1280;

/** A critical bug of the demo dataset. */
const SAFARI_TITLE = 'Sign-in page crashes on Safari';

/** A question of the demo dataset. */
const QUESTION_TITLE = 'How do I change the e-mail address of my account?';

/** Text matched literally inside a regular expression. */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The API through the BFF as the signed-in team member, with the `Origin` of changes (§14.4). */
function teamApi(baseURL: string): Promise<APIRequestContext> {
  return request.newContext({
    baseURL,
    storageState: TEAM_STORAGE_STATE,
    extraHTTPHeaders: { Origin: new URL(baseURL).origin },
  });
}

interface TicketReply {
  id: string;
  identifier: string;
  version: number;
}

interface ProjectReply {
  id: string;
  key: string;
  name: string;
}

async function projectOf(api: APIRequestContext, name: string): Promise<ProjectReply> {
  const response = await api.get('/api/v1/projects?state=active');
  expect(response.status()).toBe(200);
  const { items } = (await response.json()) as { items: ProjectReply[] };
  const project = items.find((candidate) => candidate.name === name);
  expect(project, name).toBeDefined();
  return project!;
}

async function projectIdOf(api: APIRequestContext, name: string): Promise<string> {
  return (await projectOf(api, name)).id;
}

/** A team member of a project with a display name, from the people of the assignee filter. */
async function memberOf(api: APIRequestContext, projectId: string): Promise<string> {
  const response = await api.get(`/api/v1/project-members?projectId=${projectId}`);
  expect(response.status()).toBe(200);
  const { items } = (await response.json()) as { items: { displayName: string | null }[] };
  const name = items.find((person) => person.displayName !== null)?.displayName;
  expect(name, 'a member with a display name').toBeDefined();
  return name!;
}

async function createTicket(api: APIRequestContext, projectId: string, title: string) {
  const response = await api.post('/api/v1/tickets', { data: { projectId, title } });
  expect(response.status()).toBe(201);
  return (await response.json()) as TicketReply;
}

// The team's ticket list of S1-13 on phone, tablet and desktop, with axe (§13.4).
test.describe('the ticket list', () => {
  test('renders as cards on a phone and as a table from the tablet width on', async ({
    page,
  }, testInfo) => {
    await page.goto('/tickets?view=pending_sharing_approvals');

    const isCards = (page.viewportSize()?.width ?? 0) < TABLET_BREAKPOINT_PX;
    // A pending sharing request is listed in "Pending sharing approvals" (plan, S1-13).
    await expect(page.getByRole('link', { name: PENDING_TITLE })).toBeVisible();
    await expect(page.getByRole('table')).toHaveCount(isCards ? 0 : 1);
    await expect(page.getByRole('button', { name: 'Approve sharing' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Refuse sharing' }).first()).toBeVisible();
    if (!isCards) {
      // The table fits the content area: no column – above all no action – hides behind
      // horizontal scrolling (S1-13 QA).
      const overflow = await page
        .locator('[data-slot=table-container]')
        .evaluate((container) => container.scrollWidth - container.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    }
    expect(await seriousViolations(page), testInfo.project.name).toEqual([]);
  });

  // The type on phone cards and tablets (§8.1, .ai/specs/implemented/2026-11-10-ticket-type-on-cards.md).
  for (const { url, title, type } of [
    { url: '/tickets?type=bug&priority=critical', title: SAFARI_TITLE, type: 'Bug' },
    { url: '/tickets?type=question', title: QUESTION_TITLE, type: 'Question' },
    { url: '/tickets?view=pending_sharing_approvals', title: PENDING_TITLE, type: 'Not set' },
  ]) {
    test(`shows the type "${type}" on every device`, async ({ page }, testInfo) => {
      await page.goto(url);
      const width = page.viewportSize()?.width ?? 0;
      if (width < TABLET_BREAKPOINT_PX) {
        // The card: `<identifier> · <type>` on one line; the separator is not in the link's name.
        const link = page.getByRole('link', {
          name: new RegExp(`^[A-Z]+-\\d+ ${type} ${escapeRegExp(title)}$`),
        });
        await expect(link).toBeVisible();
        const line = link.locator('> span').first();
        await expect(line).toHaveText(new RegExp(`^[A-Z]+-\\d+ · ${type}$`));
        const lineBox = await line.boundingBox();
        expect(lineBox?.height, 'one line').toBeLessThan(20);
        // With a one-line title the link keeps the 44 px of S1-13.
        const titleBox = await link.locator('> span').last().boundingBox();
        if ((titleBox?.height ?? 0) < 30) {
          expect((await link.boundingBox())?.height, 'the card keeps its height').toBe(44);
        }
      } else {
        const table = page.getByRole('table');
        const row = table.getByRole('row').filter({ has: page.getByRole('link', { name: title }) });
        const idCell = row.getByRole('cell').nth(1);
        const titleCell = row.getByRole('cell').nth(2);
        const isDesktop = width >= DESKTOP_BREAKPOINT_PX;
        await expect(table.getByRole('columnheader', { name: 'Type' })).toBeVisible({
          visible: isDesktop,
        });
        if (isDesktop) {
          // The type column, and only the identifier and the title in their cells.
          await expect(idCell).toHaveText(/^[A-Z]+-\d+$/);
          await expect(titleCell.getByText(type, { exact: true })).toBeHidden();
          await expect(row.getByRole('cell', { name: type, exact: true })).toBeVisible();
        } else {
          // The type below the title on one line; the table still fits without scrolling.
          await expect(idCell).toHaveText(/^[A-Z]+-\d+$/);
          const typeLine = titleCell.getByText(type, { exact: true });
          await expect(typeLine).toBeVisible();
          expect((await typeLine.boundingBox())?.height, 'one line').toBeLessThan(20);
          const overflow = await page
            .locator('[data-slot=table-container]')
            .evaluate((container) => container.scrollWidth - container.clientWidth);
          expect(overflow).toBeLessThanOrEqual(0);
        }
      }
      expect(await seriousViolations(page), testInfo.project.name).toEqual([]);
    });
  }

  // The longest type labels are Polish („Funkcjonalność”, „Nie ustawiono”): on the narrowest
  // tablet they stay on one line below the title and do not widen the table (§8.1).
  test.describe('in Polish on the narrowest tablet', () => {
    test.use({ locale: 'pl-PL', viewport: { width: TABLET_BREAKPOINT_PX, height: 1024 } });

    for (const { url, title, type } of [
      {
        url: '/tickets?type=feature',
        title: 'Export the invoice list to CSV',
        type: 'Funkcjonalność',
      },
      {
        url: '/tickets?view=pending_sharing_approvals',
        title: PENDING_TITLE,
        type: 'Nie ustawiono',
      },
    ]) {
      test(`shows the type "${type}" without scrolling the table`, async ({ page }) => {
        test.skip(test.info().project.name !== 'tablet', 'one tablet width');
        await page.goto(url);
        const row = page
          .getByRole('table')
          .getByRole('row')
          .filter({ has: page.getByRole('link', { name: title }) });
        const typeLine = row.getByRole('cell').nth(2).getByText(type, { exact: true });
        await expect(typeLine).toBeVisible();
        expect((await typeLine.boundingBox())?.height, 'one line').toBeLessThan(20);
        const overflow = await page
          .locator('[data-slot=table-container]')
          .evaluate((container) => container.scrollWidth - container.clientWidth);
        expect(overflow).toBeLessThanOrEqual(0);
      });
    }
  });

  // The sharing actions wrap their labels inside the title cell, which is at least 112 px wide on
  // the narrowest tablet: a longer translation never draws over the Status column (#296).
  for (const { locale, approve, refuse } of [
    { locale: 'en-US', approve: 'Approve sharing', refuse: 'Refuse sharing' },
    { locale: 'pl-PL', approve: 'Zatwierdź udostępnienie', refuse: 'Odmów udostępnienia' },
  ]) {
    test.describe(`in ${locale} on the narrowest tablet`, () => {
      test.use({ locale, viewport: { width: TABLET_BREAKPOINT_PX, height: 1024 } });

      test('keeps the sharing actions inside the title cell', async ({ page }) => {
        test.skip(test.info().project.name !== 'tablet', 'one tablet width');
        await page.goto('/tickets?view=pending_sharing_approvals');
        const row = page
          .getByRole('table')
          .getByRole('row')
          .filter({ has: page.getByRole('link', { name: PENDING_TITLE }) });
        const titleCell = row.getByRole('cell').nth(2);
        const titleBox = await titleCell.boundingBox();
        const statusBox = await row.getByRole('cell').nth(3).boundingBox();
        for (const name of [approve, refuse]) {
          const action = titleCell.getByRole('button', { name });
          await expectTouchTarget(action, minimumTargetSize(test.info()));
          const box = await action.boundingBox();
          expect(box?.x, name).toBeGreaterThanOrEqual(titleBox?.x ?? Infinity);
          expect((box?.x ?? Infinity) + (box?.width ?? 0), name).toBeLessThanOrEqual(
            Math.min((titleBox?.x ?? 0) + (titleBox?.width ?? 0), statusBox?.x ?? 0),
          );
        }
        const overflow = await page
          .locator('[data-slot=table-container]')
          .evaluate((container) => container.scrollWidth - container.clientWidth);
        expect(overflow).toBeLessThanOrEqual(0);

        // A wrapped action still opens its confirmation dialog. A click on the server-rendered
        // button before the hydration does nothing, so it is repeated.
        await expect(async () => {
          await titleCell.getByRole('button', { name: approve }).click({ timeout: 2_000 });
          await expect(page.getByRole('dialog')).toBeVisible({ timeout: 2_000 });
        }).toPass();
      });
    });
  }

  test('keeps the filters in the URL and leaves the view when a filter changes', async ({
    page,
  }) => {
    await page.goto('/tickets?view=triage');
    await expect(page.getByRole('heading', { level: 1, name: 'Tickets' })).toBeVisible();

    // The chip of the view's status filter: removing it makes the person's own empty filter. A
    // click on the server-rendered chip before the hydration does nothing, so it is repeated.
    await expect(async () => {
      if (!page.url().endsWith('?view=custom')) {
        await page.getByRole('button', { name: /^Remove filter Status/ }).click({ timeout: 2_000 });
      }
      await expect(page).toHaveURL(/\/tickets\?view=custom$/, { timeout: 2_000 });
    }).toPass();
    await page.reload();
    await expect(page).toHaveURL(/\/tickets\?view=custom$/);
    await expect(page.getByRole('button', { name: /^Remove filter/ })).toHaveCount(0);
  });

  test('reaches every field of the bottom sheet on a phone in landscape', async ({ page }) => {
    test.skip(test.info().project.name !== 'phone', 'The test turns the phone itself.');
    // Lower than the field list with its header and Done: the fields scroll, none slides under Done.
    await page.setViewportSize({ width: 740, height: 360 });
    await page.goto('/tickets?view=custom');
    const fields = page.getByRole('list', { name: 'Filters' });
    // A click on the server-rendered button before the hydration does nothing, so it is repeated.
    await expect(async () => {
      await page.getByRole('button', { name: 'Add filter' }).click({ timeout: 2_000 });
      await expect(fields).toBeVisible({ timeout: 2_000 });
    }).toPass();

    for (const field of await fields.getByRole('button').allInnerTexts()) {
      await fields.getByRole('button', { name: field.trim() }).click();
      await page.getByRole('button', { name: 'Back to filters' }).click();
    }
  });

  test('scrolls the field list inside the popover on a wide phone in landscape', async ({
    page,
  }) => {
    test.skip(test.info().project.name !== 'phone', 'The test turns the phone itself.');
    // Wide enough for the popover (≥ 48rem) but lower than its field list (UI QA of #290, D2).
    await page.setViewportSize({ width: 780, height: 360 });
    await page.goto('/tickets?view=custom');
    const fields = page.getByRole('list', { name: 'Filters' });
    await expect(async () => {
      await page.getByRole('button', { name: 'Add filter' }).click({ timeout: 2_000 });
      await expect(fields).toBeVisible({ timeout: 2_000 });
    }).toPass();

    const popup = page.locator('[data-slot="popover-content"]');
    // Measure the settled popover: it zooms in on open, and a scaled box ends short of its list.
    await popup.evaluate((element) =>
      Promise.all(element.getAnimations().map((animation) => animation.finished)),
    );
    const popupBox = (await popup.boundingBox())!;
    const listBox = (await fields.boundingBox())!;
    // The list ends inside the popover, which ends inside the screen; its last row is reached by
    // scrolling the list.
    expect(listBox.y + listBox.height).toBeLessThanOrEqual(popupBox.y + popupBox.height);
    expect(popupBox.y + popupBox.height).toBeLessThanOrEqual(360);
    const last = fields.getByRole('button').last();
    await last.scrollIntoViewIfNeeded();
    const lastBox = (await last.boundingBox())!;
    expect(lastBox.y + lastBox.height).toBeLessThanOrEqual(listBox.y + listBox.height + 1);
  });

  test('chooses a project by part of its key, then an assignee of it, and keeps both on reload', async ({
    page,
    baseURL,
  }, testInfo) => {
    const api = await teamApi(baseURL ?? '');
    let project: ProjectReply;
    let person: string;
    try {
      project = await projectOf(api, 'Customer portal');
      person = await memberOf(api, project.id);
    } finally {
      await api.dispose();
    }
    const isSheet = (page.viewportSize()?.width ?? 0) < TABLET_BREAKPOINT_PX;
    const fields = page.getByRole('list', { name: 'Filters' });
    const addFilter = async (field: string) => {
      // A click on the server-rendered button before the hydration does nothing, so it is repeated.
      await expect(async () => {
        await page.getByRole('button', { name: 'Add filter' }).click({ timeout: 2_000 });
        await expect(fields).toBeVisible({ timeout: 2_000 });
      }).toPass();
      await fields.getByRole('button', { name: field }).click();
    };
    const close = async () => {
      if (isSheet) {
        await page.getByRole('button', { name: 'Done' }).click();
      } else {
        await page.keyboard.press('Escape');
      }
      await expect(fields).toBeHidden();
    };
    await page.goto('/tickets?view=custom');

    await addFilter('Project');
    // Part of the key, in lower case: the search runs on the server, case-insensitively.
    await page
      .getByRole('combobox', { name: 'Search projects…' })
      .fill(project.key.slice(0, -1).toLowerCase());
    await page.getByRole('option', { name: `${project.key} · ${project.name}` }).click();
    await expect(page).toHaveURL(new RegExp(`projectId=${project.id}`));
    // The picker stays open with the choice ticked; axe checks the open picker on every device.
    await expect(
      page.getByRole('option', { name: `${project.key} · ${project.name}` }),
    ).toHaveAttribute('aria-selected', 'true');
    expect(await seriousViolations(page), testInfo.project.name).toEqual([]);
    await close();

    await addFilter('Assignee');
    await page.getByRole('combobox', { name: 'Search people…' }).fill(person.slice(0, 3));
    await page.getByRole('option', { name: person, exact: true }).click();
    await expect(page).toHaveURL(/assigneeId=/);
    await close();

    await page.reload();
    await expect(
      page.getByRole('button', { name: `Change filter Project: ${project.key}` }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: `Change filter Assignee: ${person}` }),
    ).toBeVisible();
  });

  test('lists a ticket changed by someone else as a conflict and keeps it selected', async ({
    page,
    baseURL,
  }, testInfo) => {
    const api = await teamApi(baseURL ?? '');
    try {
      const projectId = await projectIdOf(api, 'Customer portal');
      const suffix = `${testInfo.project.name} ${Date.now().toString(36)}`;
      const first = await createTicket(api, projectId, `Bulk E2E first ${suffix}`);
      const second = await createTicket(api, projectId, `Bulk E2E second ${suffix}`);
      await page.goto(`/tickets?projectId=${projectId}&sort=createdAt&order=desc`);
      const bar = page.getByRole('region', { name: 'Bulk actions' });
      // A server-rendered checkbox ignores a click before the hydration, so it is repeated.
      await expect(async () => {
        await page.getByRole('checkbox', { name: `Select ${first.identifier}` }).check();
        await page.getByRole('checkbox', { name: `Select ${second.identifier}` }).check();
        await expect(bar.getByText('2 selected')).toBeVisible({ timeout: 2_000 });
      }).toPass();

      // Someone else changes the second ticket after the list was read.
      const changed = await api.patch(`/api/v1/tickets/${second.id}`, {
        headers: { 'If-Match': `W/"${second.version}"` },
        data: { priority: 'high' },
      });
      expect(changed.status()).toBe(200);

      if ((page.viewportSize()?.width ?? 0) < TABLET_BREAKPOINT_PX) {
        await bar.getByRole('button', { name: 'Priority: Priority' }).click();
        await page.getByRole('radio', { name: 'Low' }).click();
      } else {
        await bar.getByRole('combobox', { name: 'Priority' }).click();
        await page.getByRole('option', { name: 'Low' }).click();
      }

      const result = page.getByRole('dialog', { name: '1 of 2 tickets updated' });
      await expect(result).toBeVisible();
      await expect(result.getByText(second.identifier)).toBeVisible();
      await expect(
        result.getByText('Changed by someone else – reload to see the latest version'),
      ).toBeVisible();
      expect(await seriousViolations(page)).toEqual([]);
      // The footer's Close, before the dialog's own close button (also named Close) in the DOM.
      await result.getByRole('button', { name: 'Close' }).first().click();
      await expect(
        page.getByRole('checkbox', { name: `Select ${second.identifier}` }),
      ).toBeChecked();
      await expect(
        page.getByRole('checkbox', { name: `Select ${first.identifier}` }),
      ).not.toBeChecked();
    } finally {
      await api.dispose();
    }
  });
});
