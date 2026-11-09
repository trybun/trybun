import { type APIRequestContext, expect, request, test } from '@playwright/test';
import { seriousViolations } from './accessibility.js';
import { TEAM_STORAGE_STATE } from './storage-state.js';

/**
 * `TABLET_MEDIA_QUERY` of `@trybun/ui` (48rem): below it the bulk pickers are bottom sheets, and
 * the list is cards below `md` – the same width.
 */
const TABLET_BREAKPOINT_PX = 768;

/** A pending sharing request of the demo dataset, in the Customer portal (S1-11). */
const PENDING_TITLE = 'Show the delivery date on the order page';

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

async function projectIdOf(api: APIRequestContext, name: string): Promise<string> {
  const response = await api.get('/api/v1/projects?state=active');
  expect(response.status()).toBe(200);
  const { items } = (await response.json()) as { items: { id: string; name: string }[] };
  const project = items.find((candidate) => candidate.name === name);
  expect(project, name).toBeDefined();
  return project!.id;
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
    expect(await seriousViolations(page), testInfo.project.name).toEqual([]);
  });

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
      await result.getByRole('button', { name: 'Close' }).click();
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
